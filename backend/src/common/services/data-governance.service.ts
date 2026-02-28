import { Injectable } from '@nestjs/common';
import { Neo4jService } from 'nest-neo4j';
import { QdrantService } from '../services/qdrant.service';
import { DataClassificationService } from './data-classification.service';

export interface DataLineageNode {
  id: string;
  name: string;
  type: string;
  operation: string;
  timestamp: Date;
  source: string;
  destination: string;
}

export interface DataQualityRule {
  id: string;
  name: string;
  description: string;
  entityType: string;
  field: string;
  condition: string;
  value: any;
  severity: 'info' | 'warning' | 'error';
  createdAt: Date;
  createdBy: string;
}

export interface DataQualityReport {
  entityId: string;
  entityType: string;
  overallScore: number;
  scores: {
    completeness: number;
    validity: number;
    consistency: number;
    uniqueness: number;
    accuracy: number;
  };
  issues: {
    field: string;
    severity: string;
    message: string;
  }[];
  timestamp: Date;
}

@Injectable()
export class DataGovernanceService {
  constructor(
    private neo4jService: Neo4jService,
    private qdrantService: QdrantService,
    private dataClassificationService: DataClassificationService,
  ) {}

  async getEntityLineage(entityId: string): Promise<DataLineageNode[]> {
    // Find all transformations and operations related to this entity
    const cypher = `
      MATCH (startEntity)-[:LINEAGE_START]->(lineage:DataLineage)-[:LINEAGE_END]->(endEntity)
      WHERE startEntity.id = $entityId OR endEntity.id = $entityId
      WITH lineage
      MATCH (lineage)-[:HAS_OPERATION]->(op:Operation)
      MATCH (lineage)-[:HAS_SOURCE]->(source:DataSource)
      MATCH (lineage)-[:HAS_DESTINATION]->(dest:DataDestination)
      RETURN {
        id: lineage.id,
        name: lineage.name,
        type: lineage.type,
        operation: op.name,
        timestamp: lineage.timestamp,
        source: source.name,
        destination: dest.name
      } AS lineageNode
      ORDER BY lineage.timestamp DESC
    `;

    const result = await this.neo4jService.read(cypher, { entityId });
    return result.records.map(record => {
      const node = record.get('lineageNode');
      return {
        ...node,
        timestamp: new Date(node.timestamp)
      };
    });
  }

  async anonymizeData(data: any): Promise<any> {
    // Apply various anonymization techniques based on data classification
    const processedData = { ...data };
    
    // Process each field in the data
    for (const [key, value] of Object.entries(processedData)) {
      if (typeof value === 'string') {
        // Check if this field contains sensitive data using classification
        const classification = await this.estimateFieldClassification(key, value);
        
        if (classification.sensitivityLevel === 'restricted' || classification.sensitivityLevel === 'confidential') {
          processedData[key] = this.anonymizeValue(value, classification);
        }
      } else if (typeof value === 'object' && value !== null) {
        // Recursively anonymize nested objects
        processedData[key] = await this.anonymizeData(value);
      }
    }

    return processedData;
  }

  async discoverSensitiveData(scanScope?: string): Promise<any[]> {
    // Discover potentially sensitive data in the system
    let cypher = '';
    const params: any = {};

    if (scanScope === 'all_entities') {
      cypher = `
        MATCH (e)
        WHERE e:Entity OR e:Customer OR e:User OR e:Person
        RETURN e
        LIMIT 100
      `;
    } else if (scanScope) {
      cypher = `
        MATCH (e:\`${scanScope}\`)
        RETURN e
        LIMIT 100
      `;
    } else {
      cypher = `
        MATCH (e)
        WHERE ANY(label IN labels(e) WHERE label IN ['Entity', 'Customer', 'User', 'Person'])
        RETURN e
        LIMIT 100
      `;
    }

    const result = await this.neo4jService.read(cypher, params);
    const sensitiveData = [];

    for (const record of result.records) {
      const entity = record.get('e');
      const entityData = entity.properties;
      
      // Analyze each property for potential sensitivity
      for (const [key, value] of Object.entries(entityData)) {
        if (await this.isPotentiallySensitive(key, value)) {
          sensitiveData.push({
            entityId: entity.identity,
            entityType: entity.labels[0],
            fieldName: key,
            fieldValue: this.maskValue(value),
            confidence: await this.estimateSensitivity(key, value)
          });
        }
      }
    }

    return sensitiveData;
  }

  async getEntityQualityScore(entityId: string): Promise<DataQualityReport> {
    // Calculate a quality score for a specific entity
    const cypher = 'MATCH (e) WHERE e.id = $entityId RETURN e';
    const result = await this.neo4jService.read(cypher, { entityId });

    if (result.records.length === 0) {
      throw new Error(`Entity with id ${entityId} not found`);
    }

    const entity = result.records[0].get('e').properties;
    const entityType = result.records[0].get('e').labels[0];

    // Get all quality rules for this entity type
    const rules = await this.getDataQualityRules(entityType);

    // Calculate scores
    let completenessScore = 0;
    let validityScore = 0;
    let consistencyScore = 0;
    let uniquenessScore = 100; // Assume unique by default
    let accuracyScore = 100; // Assume accurate by default

    const issues = [];

    for (const rule of rules) {
      const fieldValue = this.getFieldValue(entity, rule.field);
      
      if (fieldValue === undefined || fieldValue === null) {
        // Missing field - affects completeness
        completenessScore -= 20;
        issues.push({
          field: rule.field,
          severity: 'error',
          message: `Missing required field: ${rule.field}`
        });
      } else {
        // Check validity based on rule
        const valid = this.checkRuleCondition(fieldValue, rule.condition, rule.value);
        if (!valid) {
          validityScore -= 20;
          issues.push({
            field: rule.field,
            severity: rule.severity,
            message: `Field ${rule.field} does not meet requirement: ${rule.description}`
          });
        }
      }
    }

    // Normalize scores to 0-100 range
    completenessScore = Math.max(0, 100 + completenessScore);
    validityScore = Math.max(0, 100 + validityScore);
    consistencyScore = Math.max(0, 100 + consistencyScore);

    const overallScore = (completenessScore + validityScore + consistencyScore + uniquenessScore + accuracyScore) / 5;

    return {
      entityId,
      entityType,
      overallScore,
      scores: {
        completeness: completenessScore,
        validity: validityScore,
        consistency: consistencyScore,
        uniqueness: uniquenessScore,
        accuracy: accuracyScore
      },
      issues,
      timestamp: new Date()
    };
  }

  async getDataQualityReport(options: { 
    entityType?: string; 
    startDate?: Date; 
    endDate?: Date 
  }): Promise<DataQualityReport[]> {
    // Get quality reports for multiple entities
    let cypher = 'MATCH (e)';
    
    const conditions = [];
    const params: any = {};

    if (options.entityType) {
      cypher += ` WHERE e:${options.entityType}`;
    } else {
      conditions.push("ANY(label IN labels(e) WHERE label IN ['Entity', 'Customer', 'User', 'Order'])");
    }

    if (options.startDate || options.endDate) {
      if (conditions.length > 0) cypher += ' AND ';
      cypher += 'e.createdAt >= $startDate AND e.createdAt <= $endDate';
      params.startDate = options.startDate?.toISOString() || new Date(0).toISOString();
      params.endDate = options.endDate?.toISOString() || new Date().toISOString();
    }

    cypher += ' RETURN e LIMIT 50';

    const result = await this.neo4jService.read(cypher, params);
    const reports = [];

    for (const record of result.records) {
      const entity = record.get('e');
      const report = await this.getEntityQualityScore(entity.properties.id);
      reports.push(report);
    }

    return reports;
  }

  async createDataQualityRule(rule: Partial<DataQualityRule>): Promise<DataQualityRule> {
    const id = `dqr_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const now = new Date().toISOString();

    const cypher = `
      CREATE (rule:DataQualityRule {
        id: $id,
        name: $name,
        description: $description,
        entityType: $entityType,
        field: $field,
        condition: $condition,
        value: $value,
        severity: $severity,
        createdAt: $createdAt,
        createdBy: $createdBy
      })
      RETURN rule
    `;

    const result = await this.neo4jService.write(cypher, {
      id,
      name: rule.name,
      description: rule.description,
      entityType: rule.entityType,
      field: rule.field,
      condition: rule.condition,
      value: rule.value,
      severity: rule.severity || 'error',
      createdAt: now,
      createdBy: rule.createdBy || 'system'
    });

    const props = result.records[0].get('rule').properties;
    return this.mapToQualityRule(props);
  }

  async getDataQualityRules(entityType?: string): Promise<DataQualityRule[]> {
    let cypher = 'MATCH (rule:DataQualityRule) RETURN rule ORDER BY rule.createdAt DESC';
    const params: any = {};

    if (entityType) {
      cypher = 'MATCH (rule:DataQualityRule {entityType: $entityType}) RETURN rule ORDER BY rule.createdAt DESC';
      params.entityType = entityType;
    }

    const result = await this.neo4jService.read(cypher, params);
    return result.records.map(record => {
      const props = record.get('rule').properties;
      return this.mapToQualityRule(props);
    });
  }

  async validateDataQuality(data: any): Promise<{ isValid: boolean; issues: any[] }> {
    // Validate data against quality rules
    const issues = [];
    let isValid = true;

    // Get all applicable quality rules
    // For now, we'll check against common fields
    const rules = await this.getDataQualityRules();

    for (const rule of rules) {
      const fieldValue = this.getFieldValue(data, rule.field);
      
      if (fieldValue !== undefined && fieldValue !== null) {
        const valid = this.checkRuleCondition(fieldValue, rule.condition, rule.value);
        if (!valid) {
          issues.push({
            field: rule.field,
            severity: rule.severity,
            message: `Field ${rule.field} does not meet requirement: ${rule.description}`,
            expected: rule.value,
            actual: fieldValue
          });
          
          if (rule.severity === 'error') {
            isValid = false;
          }
        }
      }
    }

    return { isValid, issues };
  }

  private async estimateFieldClassification(fieldName: string, fieldValue: any): Promise<any> {
    // Estimate classification based on field name and value
    const lowerFieldName = fieldName.toLowerCase();
    
    // Common sensitive field patterns
    const sensitivePatterns = [
      { pattern: ['email', 'mail'], sensitivity: 'confidential' },
      { pattern: ['phone', 'mobile', 'tel'], sensitivity: 'confidential' },
      { pattern: ['ssn', 'social', 'national_id'], sensitivity: 'restricted' },
      { pattern: ['address', 'location'], sensitivity: 'internal' },
      { pattern: ['password', 'secret', 'key'], sensitivity: 'restricted' },
      { pattern: ['account', 'credit_card', 'payment'], sensitivity: 'restricted' },
      { pattern: ['salary', 'income', 'pay'], sensitivity: 'confidential' }
    ];
    
    for (const { pattern, sensitivity } of sensitivePatterns) {
      if (pattern.some(p => lowerFieldName.includes(p))) {
        return { sensitivityLevel: sensitivity };
      }
    }
    
    // If no pattern matches, return default
    return { sensitivityLevel: 'public' };
  }

  private anonymizeValue(value: any, classification: any): any {
    if (typeof value === 'string') {
      if (classification.sensitivityLevel === 'restricted') {
        // Complete anonymization
        return '[ANONYMIZED_RESTRICTED]';
      } else if (classification.sensitivityLevel === 'confidential') {
        // Partial anonymization
        if (value.includes('@')) {
          // Email
          const [local, domain] = value.split('@');
          return `${local.charAt(0)}***@${domain}`;
        } else if (value.length > 5) {
          // General string
          return `${value.substring(0, 2)}***${value.substring(value.length - 2)}`;
        }
      }
    }
    
    // For other types, return generic anonymized value
    return `[ANONYMIZED_${classification.sensitivityLevel.toUpperCase()}]`;
  }

  private async isPotentiallySensitive(fieldName: string, value: any): Promise<boolean> {
    // Check if a field-value pair is potentially sensitive
    const classification = await this.estimateFieldClassification(fieldName, value);
    return ['restricted', 'confidential', 'internal'].includes(classification.sensitivityLevel);
  }

  private maskValue(value: any): any {
    if (typeof value === 'string') {
      if (value.includes('@')) {
        // Email
        const [local, domain] = value.split('@');
        return `${local.charAt(0)}***@${domain}`;
      } else if (value.length > 4) {
        // General string
        return `${value.substring(0, 2)}***${value.substring(value.length - 2)}`;
      }
    }
    return '[MASKED]';
  }

  private async estimateSensitivity(fieldName: string, value: any): number {
    // Estimate sensitivity confidence as a number between 0 and 1
    const classification = await this.estimateFieldClassification(fieldName, value);
    
    switch (classification.sensitivityLevel) {
      case 'restricted': return 0.9;
      case 'confidential': return 0.7;
      case 'internal': return 0.5;
      default: return 0.1;
    }
  }

  private getFieldValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private checkRuleCondition(fieldValue: any, condition: string, expectedValue: any): boolean {
    switch (condition) {
      case 'required':
        return fieldValue !== undefined && fieldValue !== null && fieldValue !== '';
      case 'email_format':
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(fieldValue));
      case 'min_length':
        return String(fieldValue).length >= expectedValue;
      case 'max_length':
        return String(fieldValue).length <= expectedValue;
      case 'min_value':
        return Number(fieldValue) >= expectedValue;
      case 'max_value':
        return Number(fieldValue) <= expectedValue;
      case 'regex':
        return new RegExp(expectedValue).test(String(fieldValue));
      case 'enum':
        return Array.isArray(expectedValue) ? expectedValue.includes(fieldValue) : expectedValue === fieldValue;
      default:
        return fieldValue === expectedValue;
    }
  }

  private mapToQualityRule(props: any): DataQualityRule {
    return {
      id: props.id,
      name: props.name,
      description: props.description,
      entityType: props.entityType,
      field: props.field,
      condition: props.condition,
      value: props.value,
      severity: props.severity,
      createdAt: new Date(props.createdAt),
      createdBy: props.createdBy
    };
  }
}