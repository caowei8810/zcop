import { Injectable } from '@nestjs/common';
import { Neo4jService } from 'nest-neo4j';

@Injectable()
export class ComplianceMonitoringService {
  constructor(private neo4jService: Neo4jService) {}

  async createCompliancePolicy(policyDefinition: any): Promise<any> {
    // Validate policy definition
    const validation = this.validatePolicyDefinition(policyDefinition);
    if (!validation.isValid) {
      throw new Error(`Invalid policy definition: ${validation.errors.join(', ')}`);
    }

    const cypher = `
      CREATE (policy:CompliancePolicy {
        id: $id,
        name: $name,
        description: $description,
        category: $category,
        jurisdiction: $jurisdiction,
        applicableEntities: $applicableEntities,
        requirements: $requirements,
        controls: $controls,
        monitoringFrequency: $monitoringFrequency,
        createdAt: $createdAt,
        updatedAt: $updatedAt,
        status: $status,
        version: $version,
        createdBy: $createdBy
      })
      RETURN policy
    `;

    const id = `pol-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const now = new Date().toISOString();

    const result = await this.neo4jService.write(cypher, {
      id,
      name: policyDefinition.name,
      description: policyDefinition.description,
      category: policyDefinition.category || 'general',
      jurisdiction: policyDefinition.jurisdiction || 'global',
      applicableEntities: JSON.stringify(policyDefinition.applicableEntities || []),
      requirements: JSON.stringify(policyDefinition.requirements || []),
      controls: JSON.stringify(policyDefinition.controls || []),
      monitoringFrequency: policyDefinition.monitoringFrequency || 'daily',
      createdAt: now,
      updatedAt: now,
      status: policyDefinition.status || 'draft',
      version: policyDefinition.version || '1.0.0',
      createdBy: policyDefinition.createdBy || 'system'
    });

    return result.records[0].get('policy');
  }

  async activateCompliancePolicy(policyId: string, activatedBy: string): Promise<any> {
    const cypher = `
      MATCH (policy:CompliancePolicy {id: $policyId})
      WHERE policy.status IN ['draft', 'testing']
      SET policy.status = 'active',
          policy.activatedAt = $activatedAt,
          policy.activatedBy = $activatedBy,
          policy.updatedAt = $updatedAt
      RETURN policy
    `;

    const result = await this.neo4jService.write(cypher, {
      policyId,
      activatedAt: new Date().toISOString(),
      activatedBy,
      updatedAt: new Date().toISOString()
    });

    if (result.records.length === 0) {
      throw new Error(`Policy ${policyId} not found or not in draft/testing status`);
    }

    return result.records[0].get('policy');
  }

  async monitorCompliance(policyId: string, context: any = {}): Promise<any> {
    // Get policy definition
    const policy = await this.getCompliancePolicy(policyId);
    if (!policy || policy.status !== 'active') {
      throw new Error(`Policy ${policyId} not found or not active`);
    }

    const requirements = JSON.parse(policy.requirements);
    const applicableEntities = JSON.parse(policy.applicableEntities);

    // Check compliance for each requirement
    const complianceResults = [];
    let totalRequirements = 0;
    let compliantRequirements = 0;

    for (const requirement of requirements) {
      totalRequirements++;

      const result = await this.checkRequirementCompliance(requirement, applicableEntities, context);
      
      if (result.compliant) {
        compliantRequirements++;
      }

      complianceResults.push({
        requirementId: requirement.id,
        requirementDescription: requirement.description,
        compliant: result.compliant,
        evidence: result.evidence,
        details: result.details,
        timestamp: new Date().toISOString()
      });
    }

    const overallCompliance = totalRequirements > 0 
      ? (compliantRequirements / totalRequirements) * 100 
      : 0;

    // Create compliance assessment
    const assessment = {
      policyId,
      policyName: policy.name,
      overallCompliancePercentage: overallCompliance,
      totalRequirements,
      compliantRequirements,
      nonCompliantRequirements: totalRequirements - compliantRequirements,
      results: complianceResults,
      assessedAt: new Date().toISOString(),
      context
    };

    // Store the assessment
    await this.storeComplianceAssessment(assessment);

    return assessment;
  }

  async getCompliancePolicy(policyId: string): Promise<any> {
    const cypher = `
      MATCH (policy:CompliancePolicy {id: $policyId})
      RETURN policy
    `;

    const result = await this.neo4jService.read(cypher, { policyId });
    return result.records.length > 0 ? result.records[0].get('policy') : null;
  }

  async getCompliancePolicies(filter: any = {}): Promise<any[]> {
    let whereClause = '';
    const params: any = {};

    if (filter.status) {
      whereClause = 'WHERE policy.status = $status ';
      params.status = filter.status;
    }

    if (filter.category) {
      if (whereClause) whereClause += 'AND ';
      else whereClause = 'WHERE ';
      whereClause += 'policy.category = $category ';
      params.category = filter.category;
    }

    if (filter.jurisdiction) {
      if (whereClause) whereClause += 'AND ';
      else whereClause = 'WHERE ';
      whereClause += 'policy.jurisdiction = $jurisdiction ';
      params.jurisdiction = filter.jurisdiction;
    }

    const cypher = `
      MATCH (policy:CompliancePolicy)
      ${whereClause}
      RETURN policy
      ORDER BY policy.createdAt DESC
    `;

    const result = await this.neo4jService.read(cypher, params);
    return result.records.map(record => record.get('policy'));
  }

  async updateCompliancePolicy(policyId: string, updates: any): Promise<any> {
    // Check if policy can be updated (only draft and testing policies)
    const policy = await this.getCompliancePolicy(policyId);
    if (!policy || !['draft', 'testing'].includes(policy.status)) {
      throw new Error(`Cannot update policy ${policyId} - only draft and testing policies can be updated`);
    }

    const cypher = `
      MATCH (policy:CompliancePolicy {id: $policyId})
      SET policy += $updates,
          policy.updatedAt = $updatedAt
      RETURN policy
    `;

    const updatesWithTimestamp = {
      ...updates,
      updatedAt: new Date().toISOString()
    };

    const result = await this.neo4jService.write(cypher, {
      policyId,
      updates: updatesWithTimestamp,
      updatedAt: new Date().toISOString()
    });

    return result.records[0].get('policy');
  }

  async deactivateCompliancePolicy(policyId: string, deactivatedBy: string): Promise<any> {
    const cypher = `
      MATCH (policy:CompliancePolicy {id: $policyId})
      WHERE policy.status = 'active'
      SET policy.status = 'inactive',
          policy.deactivatedAt = $deactivatedAt,
          policy.deactivatedBy = $deactivatedBy,
          policy.updatedAt = $updatedAt
      RETURN policy
    `;

    const result = await this.neo4jService.write(cypher, {
      policyId,
      deactivatedAt: new Date().toISOString(),
      deactivatedBy,
      updatedAt: new Date().toISOString()
    });

    if (result.records.length === 0) {
      throw new Error(`Policy ${policyId} not found or not active`);
    }

    return result.records[0].get('policy');
  }

  async generateComplianceReport(policyId: string, timeRange: any, format: string = 'json'): Promise<any> {
    // Get policy info
    const policy = await this.getCompliancePolicy(policyId);
    if (!policy) {
      throw new Error(`Policy ${policyId} not found`);
    }

    // Get all assessments for the time range
    const assessments = await this.getComplianceAssessments(policyId, timeRange);

    // Calculate trend
    const trend = this.calculateComplianceTrend(assessments);

    // Identify gaps and risks
    const gaps = this.identifyComplianceGaps(assessments);
    const risks = this.assessComplianceRisks(assessments);

    const report = {
      policyId,
      policyName: policy.name,
      reportPeriod: timeRange,
      summary: {
        latestCompliance: assessments.length > 0 ? assessments[0].overallCompliancePercentage : 0,
        averageCompliance: assessments.length > 0 
          ? assessments.reduce((sum, a) => sum + a.overallCompliancePercentage, 0) / assessments.length 
          : 0,
        assessmentsCount: assessments.length,
        trend: trend.direction,
        trendValue: trend.value
      },
      complianceDetails: assessments,
      gaps,
      risks,
      recommendations: this.generateComplianceRecommendations(gaps, risks),
      generatedAt: new Date().toISOString()
    };

    if (format === 'json') {
      return report;
    } else if (format === 'summary') {
      return {
        policyName: policy.name,
        overallCompliance: report.summary.latestCompliance,
        status: report.summary.latestCompliance >= 95 ? 'excellent' : 
                report.summary.latestCompliance >= 80 ? 'good' : 
                report.summary.latestCompliance >= 60 ? 'fair' : 'poor',
        keyGaps: report.gaps.slice(0, 3), // Top 3 gaps
        criticalRisks: report.risks.filter((r: any) => r.severity === 'critical').slice(0, 3),
        recommendations: report.recommendations.slice(0, 3)
      };
    }
  }

  async checkDataPrivacyCompliance(entityType: string, data: any, context: any = {}): Promise<any> {
    // Specific compliance check for data privacy regulations (GDPR, CCPA, etc.)
    const privacyControls = [
      'purpose_limitation',
      'data_minimization',
      'storage_limitation',
      'accuracy_requirement',
      'consent_management',
      'right_to_access',
      'right_to_rectification',
      'right_to_erasure',
      'right_to_portability',
      'automated_decision_making'
    ];

    const results = {
      entityType,
      checks: [],
      compliant: true,
      violations: [],
      recommendations: []
    };

    // Purpose limitation check
    const purposeLimitationResult = await this.checkPurposeLimitation(entityType, data, context);
    results.checks.push(purposeLimitationResult);
    if (!purposeLimitationResult.compliant) {
      results.compliant = false;
      results.violations.push(purposeLimitationResult);
    }

    // Data minimization check
    const dataMinimizationResult = await this.checkDataMinimization(entityType, data);
    results.checks.push(dataMinimizationResult);
    if (!dataMinimizationResult.compliant) {
      results.compliant = false;
      results.violations.push(dataMinimizationResult);
    }

    // Consent management check
    const consentResult = await this.checkConsentManagement(entityType, data, context);
    results.checks.push(consentResult);
    if (!consentResult.compliant) {
      results.compliant = false;
      results.violations.push(consentResult);
    }

    // Storage limitation check
    const storageLimitationResult = await this.checkStorageLimitation(entityType, data, context);
    results.checks.push(storageLimitationResult);
    if (!storageLimitationResult.compliant) {
      results.compliant = false;
      results.violations.push(storageLimitationResult);
    }

    // Generate recommendations for violations
    results.recommendations = this.generatePrivacyRecommendations(results.violations);

    return results;
  }

  async trackAuditTrail(entityId: string, entityType: string, action: string, actor: string, context: any = {}): Promise<any> {
    const cypher = `
      CREATE (audit:AuditEntry {
        id: $id,
        entityId: $entityId,
        entityType: $entityType,
        action: $action,
        actor: $actor,
        timestamp: $timestamp,
        context: $context,
        ipAddress: $ipAddress,
        userAgent: $userAgent
      })
      RETURN audit
    `;

    const id = `audit-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

    const result = await this.neo4jService.write(cypher, {
      id,
      entityId,
      entityType,
      action,
      actor,
      timestamp: new Date().toISOString(),
      context: JSON.stringify(context),
      ipAddress: context.ipAddress || 'unknown',
      userAgent: context.userAgent || 'unknown'
    });

    return result.records[0].get('audit');
  }

  async getAuditTrail(entityId?: string, filter: any = {}): Promise<any[]> {
    let whereClause = entityId ? 'WHERE audit.entityId = $entityId ' : '';
    const params: any = entityId ? { entityId } : {};

    if (filter.actor) {
      whereClause += whereClause ? 'AND ' : 'WHERE ';
      whereClause += 'audit.actor = $actor ';
      params.actor = filter.actor;
    }

    if (filter.action) {
      whereClause += whereClause ? 'AND ' : 'WHERE ';
      whereClause += 'audit.action = $action ';
      params.action = filter.action;
    }

    if (filter.startDate) {
      whereClause += whereClause ? 'AND ' : 'WHERE ';
      whereClause += 'audit.timestamp >= $startDate ';
      params.startDate = filter.startDate;
    }

    if (filter.endDate) {
      whereClause += whereClause ? 'AND ' : 'WHERE ';
      whereClause += 'audit.timestamp <= $endDate ';
      params.endDate = filter.endDate;
    }

    const cypher = `
      MATCH (audit:AuditEntry)
      ${whereClause}
      RETURN audit
      ORDER BY audit.timestamp DESC
    `;

    const result = await this.neo4jService.read(cypher, params);
    return result.records.map(record => record.get('audit'));
  }

  async generateRegulatoryFiling(policyId: string, period: any, organizationInfo: any): Promise<any> {
    // Generate regulatory filing based on compliance assessment
    const complianceReport = await this.generateComplianceReport(policyId, period, 'json');
    
    const filingTemplate = this.getFilingTemplate(policyId);
    
    // Fill the template with compliance data
    const filingData = this.fillFilingTemplate(filingTemplate, complianceReport, organizationInfo);
    
    return {
      filingType: filingTemplate.type,
      filingPeriod: period,
      organization: organizationInfo,
      complianceData: complianceReport,
      filingDocument: filingData,
      generatedAt: new Date().toISOString(),
      status: 'prepared'
    };
  }

  private async checkRequirementCompliance(requirement: any, applicableEntities: string[], context: any): Promise<any> {
    switch (requirement.type) {
      case 'data_retention':
        return await this.checkDataRetentionCompliance(requirement, applicableEntities, context);
      case 'access_control':
        return await this.checkAccessControlCompliance(requirement, applicableEntities, context);
      case 'encryption':
        return await this.checkEncryptionCompliance(requirement, applicableEntities, context);
      case 'data_breach_reporting':
        return await this.checkDataBreachReportingCompliance(requirement, applicableEntities, context);
      case 'consent_tracking':
        return await this.checkConsentTrackingCompliance(requirement, applicableEntities, context);
      case 'audit_logging':
        return await this.checkAuditLoggingCompliance(requirement, applicableEntities, context);
      default:
        return {
          compliant: false,
          evidence: [],
          details: `Unknown requirement type: ${requirement.type}`
        };
    }
  }

  private async checkDataRetentionCompliance(requirement: any, applicableEntities: string[], context: any): Promise<any> {
    // Check if data is retained according to retention policy
    const violations = [];
    const evidence = [];

    for (const entity of applicableEntities) {
      const cypher = `
        MATCH (n:\`${entity}\`)
        WHERE n.createdAt < $retentionThreshold
        RETURN count(n) AS expiredCount
      `;

      const result = await this.neo4jService.read(cypher, {
        retentionThreshold: new Date(Date.now() - (requirement.maxRetentionDays * 24 * 60 * 60 * 1000)).toISOString()
      });

      const expiredCount = result.records[0]?.get('expiredCount') || 0;

      if (expiredCount > 0) {
        violations.push({
          entity,
          expiredCount,
          requirement: requirement.description
        });
      } else {
        evidence.push({
          entity,
          message: `All ${entity} records comply with retention policy`
        });
      }
    }

    return {
      compliant: violations.length === 0,
      evidence,
      details: {
        violations,
        totalChecked: applicableEntities.length
      }
    };
  }

  private async checkAccessControlCompliance(requirement: any, applicableEntities: string[], context: any): Promise<any> {
    // Check if access controls are properly enforced
    const violations = [];
    const evidence = [];

    // This would typically integrate with identity management systems
    // For now, we'll check if entities have proper access control properties
    for (const entity of applicableEntities) {
      const cypher = `
        MATCH (n:\`${entity}\`)
        WHERE n.accessLevel IS NULL OR n.owner IS NULL
        RETURN count(n) AS nonCompliantCount
      `;

      const result = await this.neo4jService.read(cypher, {});

      const nonCompliantCount = result.records[0]?.get('nonCompliantCount') || 0;

      if (nonCompliantCount > 0) {
        violations.push({
          entity,
          nonCompliantCount,
          requirement: requirement.description
        });
      } else {
        evidence.push({
          entity,
          message: `All ${entity} records have proper access controls`
        });
      }
    }

    return {
      compliant: violations.length === 0,
      evidence,
      details: {
        violations,
        totalChecked: applicableEntities.length
      }
    };
  }

  private async checkEncryptionCompliance(requirement: any, applicableEntities: string[], context: any): Promise<any> {
    // Check if sensitive data is encrypted
    const violations = [];
    const evidence = [];

    for (const entity of applicableEntities) {
      // Check for sensitive fields that should be encrypted
      const cypher = `
        MATCH (n:\`${entity}\`)
        WHERE (n.ssn IS NOT NULL OR n.creditCard IS NOT NULL OR n.password IS NOT NULL)
        AND (n.ssn ENDS WITH '***' OR n.creditCard ENDS WITH '***' OR n.password ENDS WITH '***') = false
        RETURN count(n) AS unencryptedCount
      `;

      const result = await this.neo4jService.read(cypher, {});

      const unencryptedCount = result.records[0]?.get('unencryptedCount') || 0;

      if (unencryptedCount > 0) {
        violations.push({
          entity,
          unencryptedCount,
          requirement: requirement.description
        });
      } else {
        evidence.push({
          entity,
          message: `All sensitive data in ${entity} is properly protected`
        });
      }
    }

    return {
      compliant: violations.length === 0,
      evidence,
      details: {
        violations,
        totalChecked: applicableEntities.length
      }
    };
  }

  private async checkDataBreachReportingCompliance(requirement: any, applicableEntities: string[], context: any): Promise<any> {
    // Check if data breach incidents are properly tracked and reported
    const violations = [];
    const evidence = [];

    // Count incidents that weren't reported within required timeframe
    const cypher = `
      MATCH (incident:SecurityIncident)
      WHERE incident.createdAt > $reportingDeadline
      AND (incident.reportedAt IS NULL OR incident.reportedAt > $reportingDeadline)
      RETURN count(incident) AS lateReports
    `;

    const reportingDeadline = new Date(Date.now() - (requirement.reportingDeadlineHours || 24) * 60 * 60 * 1000).toISOString();

    const result = await this.neo4jService.read(cypher, { reportingDeadline });

    const lateReports = result.records[0]?.get('lateReports') || 0;

    if (lateReports > 0) {
      violations.push({
        count: lateReports,
        requirement: requirement.description
      });
    } else {
      evidence.push({
        message: 'All security incidents reported within required timeframe'
      });
    }

    return {
      compliant: violations.length === 0,
      evidence,
      details: {
        violations,
        totalChecked: 'incidents'
      }
    };
  }

  private async checkConsentTrackingCompliance(requirement: any, applicableEntities: string[], context: any): Promise<any> {
    // Check if user consents are properly tracked
    const violations = [];
    const evidence = [];

    const cypher = `
      MATCH (n:User)
      WHERE n.consentGivenAt IS NULL OR n.consentGivenAt < $consentRefreshDate
      RETURN count(n) AS missingConsentCount
    `;

    const consentRefreshDate = new Date(Date.now() - (requirement.consentRetentionDays || 365) * 24 * 60 * 60 * 1000).toISOString();

    const result = await this.neo4jService.read(cypher, { consentRefreshDate });

    const missingConsentCount = result.records[0]?.get('missingConsentCount') || 0;

    if (missingConsentCount > 0) {
      violations.push({
        missingConsentCount,
        requirement: requirement.description
      });
    } else {
      evidence.push({
        message: 'All users have valid consent records'
      });
    }

    return {
      compliant: violations.length === 0,
      evidence,
      details: {
        violations,
        totalChecked: 'users'
      }
    };
  }

  private async checkAuditLoggingCompliance(requirement: any, applicableEntities: string[], context: any): Promise<any> {
    // Check if proper audit logging is in place
    const violations = [];
    const evidence = [];

    // Check if audit entries exist for critical operations
    const cypher = `
      MATCH (audit:AuditEntry)
      WHERE audit.timestamp > $checkPeriod
      AND audit.action IN $criticalActions
      RETURN audit.action AS action, count(audit) AS count
    `;

    const checkPeriod = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(); // Last 7 days
    const criticalActions = ['create', 'update', 'delete', 'access'];

    const result = await this.neo4jService.read(cypher, { 
      checkPeriod, 
      criticalActions: JSON.stringify(criticalActions) 
    });

    const actionCounts = result.records.map(record => ({
      action: record.get('action'),
      count: record.get('count')
    }));

    // Verify all critical actions have audit entries
    for (const action of criticalActions) {
      const actionCount = actionCounts.find(ac => ac.action === action)?.count || 0;
      if (actionCount === 0) {
        violations.push({
          missingAction: action,
          requirement: requirement.description
        });
      } else {
        evidence.push({
          action,
          count: actionCount,
          message: `Action '${action}' properly audited`
        });
      }
    }

    return {
      compliant: violations.length === 0,
      evidence,
      details: {
        violations,
        actionCounts
      }
    };
  }

  private async storeComplianceAssessment(assessment: any): Promise<void> {
    const cypher = `
      MATCH (policy:CompliancePolicy {id: $policyId})
      CREATE (assessment:ComplianceAssessment {
        id: $assessmentId,
        policyId: $policyId,
        overallCompliancePercentage: $overallCompliancePercentage,
        totalRequirements: $totalRequirements,
        compliantRequirements: $compliantRequirements,
        nonCompliantRequirements: $nonCompliantRequirements,
        assessedAt: $assessedAt,
        context: $context
      })
      CREATE (policy)-[:HAS_ASSESSMENT]->(assessment)
    `;

    await this.neo4jService.write(cypher, {
      assessmentId: `ca-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      policyId: assessment.policyId,
      overallCompliancePercentage: assessment.overallCompliancePercentage,
      totalRequirements: assessment.totalRequirements,
      compliantRequirements: assessment.compliantRequirements,
      nonCompliantRequirements: assessment.nonCompliantRequirements,
      assessedAt: assessment.assessedAt,
      context: JSON.stringify(assessment.context)
    });
  }

  private async getComplianceAssessments(policyId: string, timeRange: any): Promise<any[]> {
    const cypher = `
      MATCH (policy:CompliancePolicy {id: $policyId})-[:HAS_ASSESSMENT]->(assessment:ComplianceAssessment)
      WHERE assessment.assessedAt >= $startTime AND assessment.assessedAt <= $endTime
      RETURN assessment
      ORDER BY assessment.assessedAt DESC
    `;

    const result = await this.neo4jService.read(cypher, {
      policyId,
      startTime: timeRange.start,
      endTime: timeRange.end
    });

    return result.records.map(record => record.get('assessment'));
  }

  private calculateComplianceTrend(assessments: any[]): any {
    if (assessments.length < 2) {
      return { direction: 'insufficient_data', value: 0 };
    }

    const first = assessments[assessments.length - 1].overallCompliancePercentage;
    const last = assessments[0].overallCompliancePercentage;
    const change = last - first;
    const percentChange = first !== 0 ? (change / first) * 100 : 0;

    let direction = 'stable';
    if (percentChange > 5) direction = 'improving';
    else if (percentChange < -5) direction = 'declining';

    return {
      direction,
      value: percentChange,
      absoluteChange: change
    };
  }

  private identifyComplianceGaps(assessments: any[]): any[] {
    if (assessments.length === 0) return [];

    // Get the most recent assessment
    const latestAssessment = assessments[0];
    const gaps = [];

    for (const result of latestAssessment.results) {
      if (!result.compliant) {
        gaps.push({
          requirementId: result.requirementId,
          requirementDescription: result.requirementDescription,
          evidence: result.evidence,
          details: result.details
        });
      }
    }

    return gaps;
  }

  private assessComplianceRisks(assessments: any[]): any[] {
    if (assessments.length === 0) return [];

    // Analyze trends and patterns to identify risks
    const risks = [];
    const latestAssessment = assessments[0];

    // Check for declining trend
    const trend = this.calculateComplianceTrend(assessments);
    if (trend.direction === 'declining') {
      risks.push({
        type: 'trend_risk',
        severity: 'high',
        description: `Compliance is declining (${trend.value.toFixed(2)}% change)`,
        recommendation: 'Immediate action required to reverse declining trend'
      });
    }

    // Check for recurring non-compliances
    const allResults = assessments.flatMap(a => a.results);
    const nonCompliantResults = allResults.filter(r => !r.compliant);
    
    // Group by requirement to find persistent issues
    const grouped = nonCompliantResults.reduce((acc, result) => {
      const key = result.requirementId;
      if (!acc[key]) acc[key] = [];
      acc[key].push(result);
      return acc;
    }, {});

    for (const [reqId, occurrences] of Object.entries(grouped as any)) {
      if (occurrences.length >= assessments.length * 0.7) { // Non-compliant in 70%+ of assessments
        const reqDesc = occurrences[0].requirementDescription;
        risks.push({
          type: 'persistent_non_compliance',
          severity: 'critical',
          description: `Requirement "${reqDesc}" is persistently non-compliant (${occurrences.length}/${assessments.length} assessments)`,
          recommendation: `Review and strengthen controls for requirement: ${reqDesc}`
        });
      }
    }

    return risks;
  }

  private generateComplianceRecommendations(gaps: any[], risks: any[]): any[] {
    const recommendations = [];

    // Recommendations for gaps
    for (const gap of gaps) {
      recommendations.push({
        type: 'gap_resolution',
        priority: 'high',
        description: `Address non-compliance for requirement: ${gap.requirementDescription}`,
        action: `Implement necessary controls to meet requirement`,
        timeline: 'within 30 days'
      });
    }

    // Recommendations for risks
    for (const risk of risks) {
      recommendations.push({
        type: risk.type,
        priority: risk.severity === 'critical' ? 'critical' : 'high',
        description: risk.description,
        action: risk.recommendation,
        timeline: risk.severity === 'critical' ? 'immediate' : 'within 60 days'
      });
    }

    return recommendations;
  }

  private async checkPurposeLimitation(entityType: string, data: any, context: any): Promise<any> {
    // Check if data is used only for specified purposes
    const cypher = `
      MATCH (n:\`${entityType}\` {id: $entityId})
      WHERE n.purpose IS NOT NULL AND $requestedPurpose IS NOT NULL
      WITH n
      WHERE NOT ($requestedPurpose IN split(n.purpose, ','))
      RETURN count(n) AS violationCount
    `;

    const result = await this.neo4jService.read(cypher, {
      entityId: data.id,
      requestedPurpose: context.requestedPurpose || context.purpose
    });

    const violationCount = result.records[0]?.get('violationCount') || 0;

    return {
      requirement: 'purpose_limitation',
      compliant: violationCount === 0,
      evidence: violationCount === 0 ? ['Data used for authorized purposes'] : ['Unauthorized purpose usage detected'],
      details: {
        violationCount,
        requestedPurpose: context.requestedPurpose || context.purpose
      }
    };
  }

  private async checkDataMinimization(entityType: string, data: any): Promise<any> {
    // Check if only necessary data fields are collected
    const requiredFields = this.getRequiredFieldsForEntity(entityType);
    const providedFields = Object.keys(data);
    const unnecessaryFields = providedFields.filter(field => !requiredFields.includes(field));

    return {
      requirement: 'data_minimization',
      compliant: unnecessaryFields.length === 0,
      evidence: unnecessaryFields.length === 0 
        ? ['Only necessary fields provided'] 
        : [`Unnecessary fields provided: ${unnecessaryFields.join(', ')}`],
      details: {
        requiredFields,
        providedFields,
        unnecessaryFields
      }
    };
  }

  private async checkConsentManagement(entityType: string, data: any, context: any): Promise<any> {
    // Check if proper consent is given for data processing
    const cypher = `
      MATCH (u:User {id: $userId})-[:HAS_CONSENT]->(c:Consent)
      WHERE c.forEntity = $entityType 
      AND c.status = 'granted'
      AND c.expiresAt > $currentTime
      RETURN c
    `;

    const result = await this.neo4jService.read(cypher, {
      userId: data.userId || context.userId,
      entityType,
      currentTime: new Date().toISOString()
    });

    const hasValidConsent = result.records.length > 0;

    return {
      requirement: 'consent_management',
      compliant: hasValidConsent,
      evidence: hasValidConsent 
        ? ['Valid consent found'] 
        : ['No valid consent found'],
      details: {
        hasValidConsent,
        userId: data.userId || context.userId
      }
    };
  }

  private async checkStorageLimitation(entityType: string, data: any, context: any): Promise<any> {
    // Check if data is stored beyond allowed retention period
    const cypher = `
      MATCH (n:\`${entityType}\` {id: $entityId})
      WHERE n.createdAt < $retentionThreshold
      RETURN count(n) AS expiredCount
    `;

    const retentionThreshold = new Date(Date.now() - (context.retentionDays || 365) * 24 * 60 * 60 * 1000).toISOString();

    const result = await this.neo4jService.read(cypher, {
      entityId: data.id,
      retentionThreshold
    });

    const expiredCount = result.records[0]?.get('expiredCount') || 0;

    return {
      requirement: 'storage_limitation',
      compliant: expiredCount === 0,
      evidence: expiredCount === 0 
        ? ['Data within retention limits'] 
        : ['Data exceeds retention limits'],
      details: {
        expiredCount,
        retentionDays: context.retentionDays || 365
      }
    };
  }

  private generatePrivacyRecommendations(violations: any[]): any[] {
    const recommendations = [];

    for (const violation of violations) {
      if (violation.requirement === 'purpose_limitation') {
        recommendations.push({
          type: 'purpose_limitation',
          action: 'Ensure data is only used for specified purposes',
          priority: 'high'
        });
      } else if (violation.requirement === 'data_minimization') {
        recommendations.push({
          type: 'data_minimization',
          action: 'Collect only necessary data fields',
          priority: 'medium'
        });
      } else if (violation.requirement === 'consent_management') {
        recommendations.push({
          type: 'consent_management',
          action: 'Obtain proper consent before data processing',
          priority: 'critical'
        });
      } else if (violation.requirement === 'storage_limitation') {
        recommendations.push({
          type: 'storage_limitation',
          action: 'Implement automatic data deletion after retention period',
          priority: 'high'
        });
      }
    }

    return recommendations;
  }

  private getRequiredFieldsForEntity(entityType: string): string[] {
    // Return the required fields for a specific entity type
    // This would normally come from a configuration or schema
    const requiredFieldsMap: { [key: string]: string[] } = {
      User: ['id', 'email', 'createdAt'],
      Order: ['id', 'userId', 'total', 'createdAt'],
      Payment: ['id', 'orderId', 'amount', 'status', 'createdAt'],
      default: ['id', 'createdAt']
    };

    return requiredFieldsMap[entityType] || requiredFieldsMap.default;
  }

  private getFilingTemplate(policyId: string): any {
    // Return the appropriate filing template based on policy
    // This would normally be stored in the system
    return {
      type: 'regulatory_filing_template',
      sections: [
        'executive_summary',
        'compliance_overview',
        'risk_assessment',
        'control_effectiveness',
        'incidents_reported',
        'corrective_actions',
        'future_plans'
      ]
    };
  }

  private fillFilingTemplate(template: any, complianceReport: any, organizationInfo: any): any {
    // Fill the template with actual data
    return {
      executiveSummary: `Compliance report for ${organizationInfo.name} covering ${complianceReport.reportPeriod.start} to ${complianceReport.reportPeriod.end}. Overall compliance: ${complianceReport.summary.latestCompliance.toFixed(2)}%.`,
      complianceOverview: complianceReport.summary,
      riskAssessment: complianceReport.risks,
      controlEffectiveness: complianceReport.complianceDetails,
      incidentsReported: [],
      correctiveActions: complianceReport.recommendations,
      futurePlans: []
    };
  }

  private validatePolicyDefinition(definition: any): { isValid: boolean; errors: string[] } {
    const errors = [];

    if (!definition.name) {
      errors.push('Policy name is required');
    }

    if (!definition.category) {
      errors.push('Policy category is required');
    }

    if (!definition.requirements || !Array.isArray(definition.requirements) || definition.requirements.length === 0) {
      errors.push('At least one requirement is required');
    }

    if (definition.requirements) {
      for (let i = 0; i < definition.requirements.length; i++) {
        const req = definition.requirements[i];
        if (!req.id) {
          errors.push(`Requirement ${i} must have an ID`);
        }
        if (!req.description) {
          errors.push(`Requirement ${i} must have a description`);
        }
        if (!req.type) {
          errors.push(`Requirement ${i} must have a type`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}