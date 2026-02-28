import { Injectable } from '@nestjs/common';
import { Neo4jService } from 'nest-neo4j';

@Injectable()
export class DataQualityService {
  constructor(private neo4jService: Neo4jService) {}

  async assessDataQuality(entityLabel: string): Promise<any> {
    // Run various data quality checks
    const completeness = await this.checkCompleteness(entityLabel);
    const uniqueness = await this.checkUniqueness(entityLabel);
    const validity = await this.checkValidity(entityLabel);
    const consistency = await this.checkConsistency(entityLabel);
    const timeliness = await this.checkTimeliness(entityLabel);

    return {
      entity: entityLabel,
      overallScore: this.calculateOverallScore(completeness, uniqueness, validity, consistency, timeliness),
      dimensions: {
        completeness,
        uniqueness,
        validity,
        consistency,
        timeliness
      },
      timestamp: new Date().toISOString()
    };
  }

  private async checkCompleteness(entityLabel: string): Promise<any> {
    // Check what percentage of required fields are filled
    const result = await this.neo4jService.read(`
      MATCH (n:\`${entityLabel}\`)
      WITH n, keys(n) AS allProps
      WHERE size(allProps) > 0
      RETURN 
        count(n) AS totalNodes,
        sum(size(allProps)) AS totalProps,
        avg(size(allProps)) AS avgPropsPerNode
    `, {});

    if (result.records.length === 0) {
      return { score: 0, details: 'No data found' };
    }

    const record = result.records[0];
    const totalNodes = record.get('totalNodes');
    const avgPropsPerNode = record.get('avgPropsPerNode');

    // Assuming an ideal scenario where each node has all expected properties
    // In a real system, we would compare against expected property count
    const estimatedCompleteness = avgPropsPerNode > 0 ? Math.min(avgPropsPerNode / 10, 1) : 0; // Simplified calculation

    return {
      score: Math.round(estimatedCompleteness * 100),
      details: {
        totalNodes,
        avgPropsPerNode,
        message: `Average of ${avgPropsPerNode} properties per node`
      }
    };
  }

  private async checkUniqueness(entityLabel: string): Promise<any> {
    // Check for duplicate nodes based on unique properties
    const result = await this.neo4jService.read(`
      MATCH (n:\`${entityLabel}\`)
      WHERE n.id IS NOT NULL
      WITH n.id AS id, count(n) AS occurrenceCount
      WHERE occurrenceCount > 1
      RETURN count(id) AS duplicateCount, collect({id: id, count: occurrenceCount}) AS duplicates
    `, {});

    const duplicateCount = result.records.length > 0 ? result.records[0].get('duplicateCount') : 0;
    const duplicates = result.records.length > 0 ? result.records[0].get('duplicates') : [];

    const totalNodesResult = await this.neo4jService.read(`
      MATCH (n:\`${entityLabel}\`)
      RETURN count(n) AS total
    `, {});
    
    const totalNodes = totalNodesResult.records[0]?.get('total') || 1; // Avoid division by zero

    const uniquenessScore = totalNodes > 0 ? (totalNodes - duplicateCount) / totalNodes : 1;
    
    return {
      score: Math.round(uniquenessScore * 100),
      details: {
        totalNodes,
        duplicateCount,
        duplicates: duplicates.slice(0, 10) // Limit to first 10 duplicates
      }
    };
  }

  private async checkValidity(entityLabel: string): Promise<any> {
    // Check if data follows expected patterns (e.g., email format, phone format)
    // For this example, we'll check for common data patterns
    const result = await this.neo4jService.read(`
      MATCH (n:\`${entityLabel}\`)
      WITH 
        count(n) AS totalNodes,
        sum(CASE WHEN n.email IS NOT NULL AND n.email CONTAINS '@' THEN 1 ELSE 0 END) AS validEmails,
        sum(CASE WHEN n.phone IS NOT NULL AND toString(n.phone) =~ '^\\\\d{10,}$' THEN 1 ELSE 0 END) AS validPhones
      RETURN totalNodes, validEmails, validPhones
    `, {});

    if (result.records.length === 0) {
      return { score: 0, details: 'No data found' };
    }

    const record = result.records[0];
    const totalNodes = record.get('totalNodes');
    const validEmails = record.get('validEmails');
    const validPhones = record.get('validPhones');

    const emailValidity = totalNodes > 0 ? validEmails / totalNodes : 1;
    const phoneValidity = totalNodes > 0 ? validPhones / totalNodes : 1;
    
    // Overall validity is average of specific validations
    const overallValidity = (emailValidity + phoneValidity) / 2;

    return {
      score: Math.round(overallValidity * 100),
      details: {
        totalNodes,
        validEmails,
        validPhones,
        emailValidity: `${Math.round(emailValidity * 100)}%`,
        phoneValidity: `${Math.round(phoneValidity * 100)}%`
      }
    };
  }

  private async checkConsistency(entityLabel: string): Promise<any> {
    // Check for consistency in data representation
    const result = await this.neo4jService.read(`
      MATCH (n:\`${entityLabel}\`)
      WITH 
        n,
        keys(n) AS properties
      WHERE size(properties) > 0
      RETURN 
        count(n) AS totalNodes,
        avg(size(properties)) AS avgProperties,
        stDev(size(properties)) AS stdDevProperties
    `, {});

    if (result.records.length === 0) {
      return { score: 0, details: 'No data found' };
    }

    const record = result.records[0];
    const totalNodes = record.get('totalNodes');
    const avgProperties = record.get('avgProperties');
    const stdDevProperties = record.get('stdDevProperties') || 0;

    // Consistency score based on standard deviation of property count
    // Lower std dev = more consistent
    const consistencyRatio = avgProperties > 0 ? stdDevProperties / avgProperties : 0;
    const consistencyScore = Math.max(0, 1 - consistencyRatio);

    return {
      score: Math.round(consistencyScore * 100),
      details: {
        totalNodes,
        avgProperties,
        stdDevProperties,
        message: 'Lower standard deviation indicates more consistent data structure'
      }
    };
  }

  private async checkTimeliness(entityLabel: string): Promise<any> {
    // Check how recent the data is
    const result = await this.neo4jService.read(`
      MATCH (n:\`${entityLabel}\`)
      WHERE n.createdAt IS NOT NULL OR n.updatedAt IS NOT NULL
      WITH 
        n,
        CASE 
          WHEN n.updatedAt IS NOT NULL THEN n.updatedAt
          WHEN n.createdAt IS NOT NULL THEN n.createdAt
          ELSE null
        END AS timestamp
      WHERE timestamp IS NOT NULL
      RETURN 
        count(timestamp) AS totalWithTimestamp,
        min(timestamp) AS oldest,
        max(timestamp) AS newest
    `, {});

    if (result.records.length === 0 || result.records[0].get('totalWithTimestamp') === 0) {
      return { score: 0, details: 'No timestamped data found' };
    }

    const record = result.records[0];
    const totalWithTimestamp = record.get('totalWithTimestamp');
    const oldest = record.get('oldest');
    const newest = record.get('newest');

    // Calculate age in days
    const now = new Date();
    const newestDate = new Date(newest);
    const daysSinceNewest = (now.getTime() - newestDate.getTime()) / (1000 * 60 * 60 * 24);

    // Timeliness score based on recency (more recent = higher score)
    const timelinessScore = Math.max(0, 100 - (daysSinceNewest * 2)); // Subtract 2 points per day

    return {
      score: Math.max(0, Math.round(timelinessScore)),
      details: {
        totalWithTimestamp,
        oldest: oldest ? new Date(oldest).toISOString() : null,
        newest: newest ? new Date(newest).toISOString() : null,
        daysSinceNewest: Math.round(daysSinceNewest),
        message: `Data was last updated ${Math.round(daysSinceNewest)} days ago`
      }
    };
  }

  private calculateOverallScore(...dimensions: any[]): number {
    // Calculate weighted average of all dimensions
    const scores = dimensions.map(d => d.score || 0);
    const sum = scores.reduce((acc, score) => acc + score, 0);
    return Math.round(sum / scores.length);
  }

  async generateDataQualityReport(entityLabel: string): Promise<any> {
    const assessment = await this.assessDataQuality(entityLabel);

    // Generate recommendations based on the assessment
    const recommendations = await this.generateRecommendations(assessment);

    return {
      report: {
        entity: entityLabel,
        overallScore: assessment.overallScore,
        dimensions: assessment.dimensions,
        timestamp: assessment.timestamp,
      },
      recommendations,
      summary: this.generateSummary(assessment, recommendations.length)
    };
  }

  private async generateRecommendations(assessment: any): Promise<any[]> {
    const recommendations = [];

    // Completeness recommendations
    if (assessment.dimensions.completeness.score < 80) {
      recommendations.push({
        dimension: 'completeness',
        priority: 'high',
        suggestion: 'Implement data entry validation to ensure required fields are filled',
        impact: 'high'
      });
    }

    // Uniqueness recommendations
    if (assessment.dimensions.uniqueness.score < 95) {
      recommendations.push({
        dimension: 'uniqueness',
        priority: 'medium',
        suggestion: 'Investigate and resolve duplicate records',
        impact: 'medium',
        details: assessment.dimensions.uniqueness.details.duplicates
      });
    }

    // Validity recommendations
    if (assessment.dimensions.validity.score < 90) {
      recommendations.push({
        dimension: 'validity',
        priority: 'high',
        suggestion: 'Implement format validation for critical fields like emails and phones',
        impact: 'high'
      });
    }

    // Consistency recommendations
    if (assessment.dimensions.consistency.score < 85) {
      recommendations.push({
        dimension: 'consistency',
        priority: 'medium',
        suggestion: 'Standardize data entry formats across the system',
        impact: 'medium'
      });
    }

    // Timeliness recommendations
    if (assessment.dimensions.timeliness.score < 70) {
      recommendations.push({
        dimension: 'timeliness',
        priority: 'medium',
        suggestion: 'Establish regular data update processes',
        impact: 'medium'
      });
    }

    return recommendations;
  }

  private generateSummary(assessment: any, numRecommendations: number): string {
    const issues = [];
    
    if (assessment.dimensions.completeness.score < 80) issues.push('completeness');
    if (assessment.dimensions.uniqueness.score < 95) issues.push('uniqueness');
    if (assessment.dimensions.validity.score < 90) issues.push('validity');
    if (assessment.dimensions.consistency.score < 85) issues.push('consistency');
    if (assessment.dimensions.timeliness.score < 70) issues.push('timeliness');
    
    if (issues.length === 0) {
      return `Data quality for ${assessment.entity} is excellent with a score of ${assessment.overallScore}%. No major issues detected.`;
    } else {
      return `Data quality for ${assessment.entity} needs improvement with a score of ${assessment.overallScore}%. Issues detected in: ${issues.join(', ')}. ${numRecommendations} recommendations provided.`;
    }
  }

  async fixDataQualityIssues(entityLabel: string, issues: string[]): Promise<any> {
    const results = [];

    for (const issue of issues) {
      switch (issue.toLowerCase()) {
        case 'completeness':
          results.push(await this.fixCompletenessIssues(entityLabel));
          break;
        case 'uniqueness':
          results.push(await this.fixUniquenessIssues(entityLabel));
          break;
        case 'validity':
          results.push(await this.fixValidityIssues(entityLabel));
          break;
        case 'consistency':
          results.push(await this.fixConsistencyIssues(entityLabel));
          break;
        case 'timeliness':
          // Timeliness is harder to "fix" automatically
          results.push({
            issue: 'timeliness',
            status: 'recommendation_only',
            message: 'Establish regular data update processes'
          });
          break;
        default:
          results.push({
            issue,
            status: 'unknown_issue_type',
            message: `Issue type ${issue} is not recognized`
          });
      }
    }

    return {
      entity: entityLabel,
      fixesApplied: results,
      timestamp: new Date().toISOString()
    };
  }

  private async fixCompletenessIssues(entityLabel: string): Promise<any> {
    // This would involve identifying missing required fields and potentially filling them
    // For this example, we'll just return a message
    return {
      issue: 'completeness',
      status: 'identified',
      message: `Identified incomplete records in ${entityLabel}. Manual review needed for missing required fields.`
    };
  }

  private async fixUniquenessIssues(entityLabel: string): Promise<any> {
    // Find and potentially merge duplicate records
    const duplicatesResult = await this.neo4jService.read(`
      MATCH (n:\`${entityLabel}\`)
      WHERE n.id IS NOT NULL
      WITH n.id AS id, collect(n) AS nodes
      WHERE size(nodes) > 1
      RETURN id, nodes
    `, {});

    const duplicates = duplicatesResult.records.map(record => ({
      id: record.get('id'),
      nodes: record.get('nodes')
    }));

    if (duplicates.length > 0) {
      return {
        issue: 'uniqueness',
        status: 'found_duplicates',
        count: duplicates.length,
        message: `Found ${duplicates.length} sets of duplicate records in ${entityLabel}. Manual merge required.`
      };
    } else {
      return {
        issue: 'uniqueness',
        status: 'no_duplicates_found',
        message: `No duplicate records found in ${entityLabel}`
      };
    }
  }

  private async fixValidityIssues(entityLabel: string): Promise<any> {
    // Identify invalid data patterns
    const invalidEmailsResult = await this.neo4jService.read(`
      MATCH (n:\`${entityLabel}\`)
      WHERE n.email IS NOT NULL AND NOT n.email CONTAINS '@'
      RETURN count(n) AS invalidEmailCount
    `, {});

    const invalidEmailCount = invalidEmailsResult.records[0]?.get('invalidEmailCount') || 0;

    const invalidPhonesResult = await this.neo4jService.read(`
      MATCH (n:\`${entityLabel}\`)
      WHERE n.phone IS NOT NULL AND NOT toString(n.phone) =~ '^\\\\d+$'
      RETURN count(n) AS invalidPhoneCount
    `, {});

    const invalidPhoneCount = invalidPhonesResult.records[0]?.get('invalidPhoneCount') || 0;

    return {
      issue: 'validity',
      status: 'identified_invalid_data',
      invalidEmails: invalidEmailCount,
      invalidPhones: invalidPhoneCount,
      message: `Found ${invalidEmailCount} invalid emails and ${invalidPhoneCount} invalid phone numbers in ${entityLabel}. Manual correction needed.`
    };
  }

  private async fixConsistencyIssues(entityLabel: string): Promise<any> {
    // Identify inconsistent property naming or values
    const result = await this.neo4jService.read(`
      MATCH (n:\`${entityLabel}\`)
      WITH keys(n) AS allProps
      UNWIND allProps AS prop
      RETURN prop, count(prop) AS propCount
      ORDER BY propCount DESC
    `, {});

    const allProps = result.records.map(record => ({
      property: record.get('prop'),
      count: record.get('propCount')
    }));

    // Identify properties that appear in less than 50% of nodes (potential inconsistency)
    const totalCountResult = await this.neo4jService.read(`
      MATCH (n:\`${entityLabel}\`)
      RETURN count(n) AS total
    `, {});
    
    const totalCount = totalCountResult.records[0]?.get('total') || 1;
    const inconsistentProps = allProps.filter(p => p.count < totalCount * 0.5);

    return {
      issue: 'consistency',
      status: 'identified_inconsistent_properties',
      inconsistentProperties: inconsistentProps,
      message: `Found ${inconsistentProps.length} potentially inconsistent properties in ${entityLabel}. Standardization recommended.`
    };
  }
}