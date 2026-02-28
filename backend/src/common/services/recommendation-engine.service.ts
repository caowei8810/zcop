import { Injectable } from '@nestjs/common';
import { Neo4jService } from 'nest-neo4j';

@Injectable()
export class RecommendationEngine {
  constructor(private neo4jService: Neo4jService) {}

  async generateBusinessRecommendations(organizationData: any): Promise<any[]> {
    const recommendations = [];

    // Analyze the organization's data to provide insights
    const graphInsights = await this.neo4jService.read(`
      MATCH (n) 
      WHERE ANY(x IN labels(n) WHERE x IN $entityTypes)
      RETURN 
        count(n) AS nodeCount,
        labels(n) AS nodeLabels
      LIMIT 10
    `, { 
      entityTypes: organizationData.entities?.map((e: any) => e.name) || []
    });

    // Generate recommendations based on data patterns
    for (const record of graphInsights.records) {
      const label = record.get('nodeLabels')[0];
      const count = record.get('nodeCount');
      
      if (count < 10) {
        recommendations.push({
          type: 'data_enrichment',
          entity: label,
          message: `Consider enriching your ${label} data - currently only ${count} records exist`,
          priority: 'medium',
          action: 'suggest_data_collection'
        });
      }
    }

    // Add relationship recommendations
    recommendations.push(...await this.generateRelationshipRecommendations(organizationData));

    // Add process recommendations
    recommendations.push(...await this.generateProcessRecommendations(organizationData));

    return recommendations;
  }

  private async generateRelationshipRecommendations(organizationData: any): Promise<any[]> {
    const recommendations = [];

    // Analyze missing relationships between entities
    if (organizationData.entities && organizationData.entities.length > 1) {
      for (let i = 0; i < organizationData.entities.length; i++) {
        for (let j = i + 1; j < organizationData.entities.length; j++) {
          const entity1 = organizationData.entities[i];
          const entity2 = organizationData.entities[j];
          
          // Check if there's a relationship between these entities
          const relCheck = await this.neo4jService.read(`
            MATCH (a:\`${entity1.name}\`)-[r]-(b:\`${entity2.name}\`)
            RETURN count(r) AS relCount
          `, {});
          
          const relCount = relCheck.records[0]?.get('relCount') || 0;
          
          if (relCount === 0) {
            recommendations.push({
              type: 'relationship_suggestion',
              entities: [entity1.name, entity2.name],
              message: `Consider creating a relationship between ${entity1.name} and ${entity2.name}`,
              priority: 'low',
              action: 'suggest_relationship_creation'
            });
          }
        }
      }
    }

    return recommendations;
  }

  private async generateProcessRecommendations(organizationData: any): Promise<any[]> {
    const recommendations = [];

    // Recommend new business processes based on entity relationships
    if (organizationData.entities) {
      for (const entity of organizationData.entities) {
        // Recommend validation processes
        if (entity.properties && entity.properties.some((p: any) => p.required)) {
          recommendations.push({
            type: 'process_recommendation',
            entity: entity.name,
            message: `Create a validation process for required properties in ${entity.name}`,
            priority: 'high',
            action: 'create_validation_workflow'
          });
        }

        // Recommend approval processes
        if (entity.properties && entity.properties.some((p: any) => p.name.toLowerCase().includes('approval'))) {
          recommendations.push({
            type: 'process_recommendation',
            entity: entity.name,
            message: `Implement an approval workflow for ${entity.name} entities`,
            priority: 'medium',
            action: 'create_approval_workflow'
          });
        }
      }
    }

    return recommendations;
  }

  async suggestOntologyImprovements(currentOntology: any): Promise<any[]> {
    const improvements = [];

    // Analyze current ontology for improvements
    if (currentOntology.entities) {
      for (const entity of currentOntology.entities) {
        // Suggest indexes for frequently queried properties
        if (entity.properties) {
          for (const prop of entity.properties) {
            if (prop.unique || prop.name.toLowerCase() === 'id') {
              improvements.push({
                type: 'performance',
                target: `${entity.name}.${prop.name}`,
                suggestion: `Create an index for ${entity.name}.${prop.name} property`,
                reason: 'Unique or ID properties benefit from indexing',
                priority: 'high'
              });
            }
          }
        }

        // Suggest relationships for common patterns
        if (entity.name.toLowerCase().includes('user') || entity.name.toLowerCase().includes('customer')) {
          improvements.push({
            type: 'structure',
            target: entity.name,
            suggestion: `Consider adding relationships from ${entity.name} to other entities`,
            reason: 'User/customer entities commonly relate to other business entities',
            priority: 'medium'
          });
        }
      }
    }

    // Suggest common business patterns
    improvements.push({
      type: 'pattern',
      target: 'general',
      suggestion: 'Consider implementing audit trail entities for tracking changes',
      reason: 'Audit trails are important for business compliance',
      priority: 'high'
    });

    improvements.push({
      type: 'pattern',
      target: 'general',
      suggestion: 'Implement soft-delete pattern with deleted_at timestamps',
      reason: 'Soft deletes preserve data integrity while allowing logical deletion',
      priority: 'medium'
    });

    return improvements;
  }

  async recommendDataQualityRules(ontology: any): Promise<any[]> {
    const rules = [];

    if (ontology.entities) {
      for (const entity of ontology.entities) {
        if (entity.properties) {
          for (const prop of entity.properties) {
            // Email validation rule
            if (prop.name.toLowerCase().includes('email') && prop.type === 'STRING') {
              rules.push({
                entity: entity.name,
                property: prop.name,
                ruleType: 'format_validation',
                expression: 'isValidEmail(value)',
                message: `${prop.name} must be a valid email address`,
                severity: 'error'
              });
            }

            // Phone validation rule
            if (prop.name.toLowerCase().includes('phone') || prop.name.toLowerCase().includes('tel')) {
              rules.push({
                entity: entity.name,
                property: prop.name,
                ruleType: 'format_validation',
                expression: 'isValidPhone(value)',
                message: `${prop.name} must be a valid phone number`,
                severity: 'warning'
              });
            }

            // Required field rule
            if (prop.required) {
              rules.push({
                entity: entity.name,
                property: prop.name,
                ruleType: 'required',
                expression: 'value !== null && value !== ""',
                message: `${prop.name} is required`,
                severity: 'error'
              });
            }

            // Range validation for numeric fields
            if (prop.type === 'NUMBER' && prop.minValue !== undefined) {
              rules.push({
                entity: entity.name,
                property: prop.name,
                ruleType: 'range_validation',
                expression: `value >= ${prop.minValue}`,
                message: `${prop.name} must be greater than or equal to ${prop.minValue}`,
                severity: 'error'
              });
            }

            if (prop.type === 'NUMBER' && prop.maxValue !== undefined) {
              rules.push({
                entity: entity.name,
                property: prop.name,
                ruleType: 'range_validation',
                expression: `value <= ${prop.maxValue}`,
                message: `${prop.name} must be less than or equal to ${prop.maxValue}`,
                severity: 'error'
              });
            }
          }
        }
      }
    }

    return rules;
  }

  async recommendReportingDashboards(ontology: any): Promise<any[]> {
    const dashboards = [];

    // Recommend basic dashboard for each major entity
    if (ontology.entities) {
      for (const entity of ontology.entities) {
        dashboards.push({
          name: `${entity.name} Overview Dashboard`,
          description: `Dashboard showing key metrics for ${entity.name} entities`,
          widgets: [
            { type: 'record_count', title: `Total ${entity.name}s`, entity: entity.name },
            { type: 'trend_chart', title: `${entity.name} Creation Trend`, entity: entity.name, metric: 'creation_date' },
            { type: 'top_entities', title: `Top ${entity.name}s by Activity`, entity: entity.name, metric: 'activity_score' }
          ],
          permissions: ['view_' + entity.name.toLowerCase()]
        });
      }
    }

    // Recommend relationship dashboard
    if (ontology.relationships && ontology.relationships.length > 0) {
      dashboards.push({
        name: 'Relationship Overview Dashboard',
        description: 'Dashboard showing key relationship metrics',
        widgets: [
          { type: 'relationship_map', title: 'Entity Relationship Map', relationships: ontology.relationships },
          { type: 'relationship_counts', title: 'Relationship Counts by Type', relationships: ontology.relationships }
        ],
        permissions: ['view_relationships']
      });
    }

    return dashboards;
  }

  async suggestAutomationOpportunities(ontology: any, businessRules: any[]): Promise<any[]> {
    const opportunities = [];

    // Suggest automations based on business rules
    for (const rule of businessRules) {
      opportunities.push({
        type: 'automation',
        rule: rule.name,
        trigger: rule.condition,
        action: rule.action,
        suggestedImplementation: 'workflow',
        complexity: 'medium',
        benefit: 'high'
      });
    }

    // Suggest automations based on entity patterns
    if (ontology.entities) {
      for (const entity of ontology.entities) {
        // Suggest auto-approval for certain entities
        if (entity.name.toLowerCase().includes('document') || entity.name.toLowerCase().includes('request')) {
          opportunities.push({
            type: 'automation',
            entity: entity.name,
            suggestedProcess: 'approval_workflow',
            trigger: 'entity_created',
            action: 'auto_route_for_approval',
            complexity: 'low',
            benefit: 'medium'
          });
        }

        // Suggest notifications for important entities
        if (entity.name.toLowerCase().includes('order') || entity.name.toLowerCase().includes('ticket')) {
          opportunities.push({
            type: 'automation',
            entity: entity.name,
            suggestedProcess: 'notification_workflow',
            trigger: 'entity_updated',
            action: 'notify_stakeholders',
            complexity: 'low',
            benefit: 'high'
          });
        }
      }
    }

    return opportunities;
  }

  async generatePersonalizedRecommendations(userId: string, userPreferences: any): Promise<any[]> {
    // Generate recommendations tailored to specific user
    const userSpecificRecs = [];

    // Based on user role
    if (userPreferences.role) {
      if (userPreferences.role === 'admin') {
        userSpecificRecs.push({
          type: 'admin',
          category: 'system',
          message: 'Review and optimize system performance settings',
          action: 'view_performance_dashboard',
          priority: 'high'
        });
      } else if (userPreferences.role === 'analyst') {
        userSpecificRecs.push({
          type: 'analysis',
          category: 'insights',
          message: 'Generate latest business insights report',
          action: 'generate_insights_report',
          priority: 'medium'
        });
      } else if (userPreferences.role === 'developer') {
        userSpecificRecs.push({
          type: 'development',
          category: 'ontology',
          message: 'Review and update ontology definitions',
          action: 'review_ontology',
          priority: 'medium'
        });
      }
    }

    // Based on user activity
    if (userPreferences.lastActiveEntity) {
      userSpecificRecs.push({
        type: 'engagement',
        category: 'data',
        message: `Continue working with ${userPreferences.lastActiveEntity} data`,
        action: `view_${userPreferences.lastActiveEntity.toLowerCase()}_dashboard`,
        priority: 'low'
      });
    }

    return userSpecificRecs;
  }
}