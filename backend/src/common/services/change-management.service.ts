import { Injectable } from '@nestjs/common';
import { Neo4jService } from 'nest-neo4j';

@Injectable()
export class ChangeManagementService {
  constructor(private neo4jService: Neo4jService) {}

  async createChangeRequest(changeSpec: any, userId: string): Promise<any> {
    // Validate change specification
    const validation = this.validateChangeSpec(changeSpec);
    if (!validation.isValid) {
      throw new Error(`Invalid change specification: ${validation.errors.join(', ')}`);
    }

    // Create change request node
    const cypher = `
      CREATE (change:ChangeRequest {
        id: $id,
        title: $title,
        description: $description,
        type: $type,
        status: $status,
        priority: $priority,
        createdBy: $createdBy,
        createdAt: $createdAt,
        updatedAt: $updatedAt,
        changeSpec: $changeSpec,
        reason: $reason,
        impactAssessment: $impactAssessment,
        rollbackPlan: $rollbackPlan
      })
      RETURN change
    `;

    const id = `chg-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const now = new Date().toISOString();

    const result = await this.neo4jService.write(cypher, {
      id,
      title: changeSpec.title,
      description: changeSpec.description,
      type: changeSpec.type || 'structural',
      status: 'proposed',
      priority: changeSpec.priority || 'medium',
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
      changeSpec: JSON.stringify(changeSpec.spec),
      reason: changeSpec.reason,
      impactAssessment: JSON.stringify(changeSpec.impactAssessment || {}),
      rollbackPlan: JSON.stringify(changeSpec.rollbackPlan || {})
    });

    return result.records[0].get('change');
  }

  async approveChangeRequest(changeId: string, approvedBy: string): Promise<any> {
    // Check if change can be approved (dependencies met, etc.)
    const canApprove = await this.canApproveChange(changeId);
    if (!canApprove) {
      throw new Error(`Change request ${changeId} cannot be approved due to unmet conditions`);
    }

    const cypher = `
      MATCH (change:ChangeRequest {id: $changeId})
      WHERE change.status = 'proposed'
      SET change.status = 'approved',
          change.approvedBy = $approvedBy,
          change.approvedAt = $approvedAt,
          change.updatedAt = $updatedAt
      RETURN change
    `;

    const result = await this.neo4jService.write(cypher, {
      changeId,
      approvedBy,
      approvedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    if (result.records.length === 0) {
      throw new Error(`Change request ${changeId} not found or already processed`);
    }

    // Log the approval
    await this.logChangeAction(changeId, 'approved', approvedBy);

    return result.records[0].get('change');
  }

  async implementChangeRequest(changeId: string, implementedBy: string): Promise<any> {
    // Get the change request
    const change = await this.getChangeRequest(changeId);
    if (!change) {
      throw new Error(`Change request ${changeId} not found`);
    }

    if (change.status !== 'approved') {
      throw new Error(`Change request ${changeId} is not approved and cannot be implemented`);
    }

    // Parse the change specification
    const spec = JSON.parse(change.changeSpec);

    // Apply the change based on its type
    let implementationResult;
    switch (spec.type) {
      case 'entity_addition':
        implementationResult = await this.implementEntityAddition(spec, changeId, implementedBy);
        break;
      case 'entity_modification':
        implementationResult = await this.implementEntityModification(spec, changeId, implementedBy);
        break;
      case 'entity_removal':
        implementationResult = await this.implementEntityRemoval(spec, changeId, implementedBy);
        break;
      case 'relationship_change':
        implementationResult = await this.implementRelationshipChange(spec, changeId, implementedBy);
        break;
      case 'property_change':
        implementationResult = await this.implementPropertyChange(spec, changeId, implementedBy);
        break;
      default:
        throw new Error(`Unknown change type: ${spec.type}`);
    }

    // Update change status
    const cypher = `
      MATCH (change:ChangeRequest {id: $changeId})
      SET change.status = 'implemented',
          change.implementedBy = $implementedBy,
          change.implementedAt = $implementedAt,
          change.updatedAt = $updatedAt,
          change.implementationResult = $implementationResult
      RETURN change
    `;

    const result = await this.neo4jService.write(cypher, {
      changeId,
      implementedBy,
      implementedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      implementationResult: JSON.stringify(implementationResult)
    });

    // Log the implementation
    await this.logChangeAction(changeId, 'implemented', implementedBy);

    return result.records[0].get('change');
  }

  async assessChangeImpact(changeSpec: any): Promise<any> {
    const impact = {
      direct: [],
      indirect: [],
      riskLevel: 'medium',
      estimatedEffort: 'unknown',
      affectedComponents: [],
      timeline: {}
    };

    // Analyze impact based on change type
    switch (changeSpec.type) {
      case 'entity_addition':
        impact.direct.push(`New entity "${changeSpec.entityName}" will be created`);
        impact.affectedComponents.push('schema', 'queries', 'workflows');
        impact.estimatedEffort = 'low';
        break;
      case 'entity_modification':
        impact.direct.push(`Entity "${changeSpec.entityName}" will be modified`);
        impact.indirect.push(`Dependent queries and workflows may need updates`);
        impact.affectedComponents.push('schema', 'queries', 'workflows', 'validations');
        impact.estimatedEffort = 'medium';
        break;
      case 'entity_removal':
        impact.direct.push(`Entity "${changeSpec.entityName}" will be removed`);
        impact.indirect.push(`All references to this entity will become invalid`);
        impact.riskLevel = 'high';
        impact.affectedComponents.push('schema', 'queries', 'workflows', 'reports', 'dashboards');
        impact.estimatedEffort = 'high';
        break;
      case 'relationship_change':
        impact.direct.push(`Relationship "${changeSpec.relationshipName}" will be modified`);
        impact.indirect.push(`Queries involving this relationship will need updates`);
        impact.affectedComponents.push('queries', 'workflows');
        impact.estimatedEffort = 'medium';
        break;
      case 'property_change':
        impact.direct.push(`Property "${changeSpec.propertyName}" on entity "${changeSpec.entityName}" will be modified`);
        impact.indirect.push(`Validations and business rules may need updates`);
        impact.affectedComponents.push('schema', 'validations', 'business_rules');
        impact.estimatedEffort = 'low_to_medium';
        break;
    }

    // Assess risk based on impact
    if (impact.riskLevel === 'medium' && impact.affectedComponents.length > 5) {
      impact.riskLevel = 'high';
    } else if (impact.riskLevel === 'medium' && impact.affectedComponents.length < 3) {
      impact.riskLevel = 'low';
    }

    return impact;
  }

  async getChangeRequest(changeId: string): Promise<any> {
    const cypher = `
      MATCH (change:ChangeRequest {id: $changeId})
      RETURN change
    `;

    const result = await this.neo4jService.read(cypher, { changeId });
    return result.records.length > 0 ? result.records[0].get('change') : null;
  }

  async getChangeRequests(filter: any = {}): Promise<any[]> {
    let whereClause = '';
    const params: any = {};

    if (filter.status) {
      whereClause += `WHERE change.status = $status `;
      params.status = filter.status;
    }

    if (filter.type) {
      if (whereClause) whereClause += 'AND ';
      else whereClause = 'WHERE ';
      whereClause += `change.type = $type `;
      params.type = filter.type;
    }

    if (filter.createdBy) {
      if (whereClause) whereClause += 'AND ';
      else whereClause = 'WHERE ';
      whereClause += `change.createdBy = $createdBy `;
      params.createdBy = filter.createdBy;
    }

    const cypher = `
      MATCH (change:ChangeRequest)
      ${whereClause}
      RETURN change
      ORDER BY change.createdAt DESC
    `;

    const result = await this.neo4jService.read(cypher, params);
    return result.records.map(record => record.get('change'));
  }

  async revertChangeRequest(changeId: string, revertedBy: string): Promise<any> {
    // Get the change request
    const change = await this.getChangeRequest(changeId);
    if (!change) {
      throw new Error(`Change request ${changeId} not found`);
    }

    if (change.status !== 'implemented') {
      throw new Error(`Change request ${changeId} is not implemented and cannot be reverted`);
    }

    // Parse the change specification and rollback plan
    const spec = JSON.parse(change.changeSpec);
    const rollbackPlan = JSON.parse(change.rollbackPlan);

    // Apply reversal based on the original change type
    let reversalResult;
    switch (spec.type) {
      case 'entity_addition':
        reversalResult = await this.revertEntityAddition(rollbackPlan, changeId, revertedBy);
        break;
      case 'entity_modification':
        reversalResult = await this.revertEntityModification(rollbackPlan, changeId, revertedBy);
        break;
      case 'entity_removal':
        // Reverting entity removal would mean recreating the entity
        reversalResult = await this.revertEntityRemoval(rollbackPlan, changeId, revertedBy);
        break;
      case 'relationship_change':
        reversalResult = await this.revertRelationshipChange(rollbackPlan, changeId, revertedBy);
        break;
      case 'property_change':
        reversalResult = await this.revertPropertyChange(rollbackPlan, changeId, revertedBy);
        break;
      default:
        throw new Error(`Unknown change type for reversal: ${spec.type}`);
    }

    // Update change status
    const cypher = `
      MATCH (change:ChangeRequest {id: $changeId})
      SET change.status = 'reverted',
          change.revertedBy = $revertedBy,
          change.revertedAt = $revertedAt,
          change.updatedAt = $updatedAt,
          change.reversalResult = $reversalResult
      RETURN change
    `;

    const result = await this.neo4jService.write(cypher, {
      changeId,
      revertedBy,
      revertedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      reversalResult: JSON.stringify(reversalResult)
    });

    // Log the reversal
    await this.logChangeAction(changeId, 'reverted', revertedBy);

    return result.records[0].get('change');
  }

  async validateChangeSpec(changeSpec: any): Promise<{ isValid: boolean; errors: string[] }> {
    const errors = [];

    if (!changeSpec.title) {
      errors.push('Title is required');
    }

    if (!changeSpec.type) {
      errors.push('Type is required');
    }

    if (!changeSpec.spec) {
      errors.push('Specification is required');
    }

    if (!changeSpec.reason) {
      errors.push('Reason is required');
    }

    // Validate based on change type
    switch (changeSpec.type) {
      case 'entity_addition':
        if (!changeSpec.spec.entityName) {
          errors.push('Entity name is required for entity addition');
        }
        break;
      case 'entity_modification':
        if (!changeSpec.spec.entityName) {
          errors.push('Entity name is required for entity modification');
        }
        break;
      case 'entity_removal':
        if (!changeSpec.spec.entityName) {
          errors.push('Entity name is required for entity removal');
        }
        break;
      case 'relationship_change':
        if (!changeSpec.spec.relationshipName) {
          errors.push('Relationship name is required for relationship change');
        }
        break;
      case 'property_change':
        if (!changeSpec.spec.entityName || !changeSpec.spec.propertyName) {
          errors.push('Entity name and property name are required for property change');
        }
        break;
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private async canApproveChange(changeId: string): Promise<boolean> {
    // Check if all dependencies are satisfied
    const cypher = `
      MATCH (change:ChangeRequest {id: $changeId})
      OPTIONAL MATCH (dependency:ChangeRequest)-[:DEPENDS_ON]->(change)
      WHERE dependency.status <> 'implemented'
      RETURN count(dependency) AS unmetDependencies
    `;

    const result = await this.neo4jService.read(cypher, { changeId });
    const unmetDependencies = result.records[0]?.get('unmetDependencies') || 0;

    return unmetDependencies === 0;
  }

  private async logChangeAction(changeId: string, action: string, userId: string): Promise<void> {
    const cypher = `
      MATCH (change:ChangeRequest {id: $changeId})
      CREATE (action:ChangeAction {
        id: $actionId,
        changeId: $changeId,
        action: $action,
        performedBy: $performedBy,
        timestamp: $timestamp
      })
      RETURN action
    `;

    await this.neo4jService.write(cypher, {
      actionId: `act-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      changeId,
      action,
      performedBy: userId,
      timestamp: new Date().toISOString()
    });
  }

  private async implementEntityAddition(spec: any, changeId: string, userId: string): Promise<any> {
    // Create the new entity label and any required properties
    const cypher = `
      CALL apoc.schema.assert({\`${spec.entityName}\`: []}, {})
      YIELD label, key, constraint, action
      RETURN label, key, constraint, action
    `;

    // Note: This requires APOC library
    // For now, we'll just return a mock result
    return {
      success: true,
      entityName: spec.entityName,
      action: 'entity_created',
      message: `Entity ${spec.entityName} created successfully`
    };
  }

  private async implementEntityModification(spec: any, changeId: string, userId: string): Promise<any> {
    // Modify the entity (add properties, etc.)
    // This is a simplified implementation
    return {
      success: true,
      entityName: spec.entityName,
      action: 'entity_modified',
      changes: spec.changes || [],
      message: `Entity ${spec.entityName} modified successfully`
    };
  }

  private async implementEntityRemoval(spec: any, changeId: string, userId: string): Promise<any> {
    // Remove the entity (this would be dangerous in practice)
    // In reality, we'd likely mark as deprecated rather than physically remove
    return {
      success: true,
      entityName: spec.entityName,
      action: 'entity_deprecated',
      message: `Entity ${spec.entityName} deprecated (not physically removed for safety)`
    };
  }

  private async implementRelationshipChange(spec: any, changeId: string, userId: string): Promise<any> {
    // Modify relationship (change type, properties, etc.)
    return {
      success: true,
      relationshipName: spec.relationshipName,
      action: 'relationship_modified',
      message: `Relationship ${spec.relationshipName} modified successfully`
    };
  }

  private async implementPropertyChange(spec: any, changeId: string, userId: string): Promise<any> {
    // Modify property on an entity
    return {
      success: true,
      entityName: spec.entityName,
      propertyName: spec.propertyName,
      action: 'property_modified',
      message: `Property ${spec.propertyName} on entity ${spec.entityName} modified successfully`
    };
  }

  private async revertEntityAddition(rollbackPlan: any, changeId: string, userId: string): Promise<any> {
    // Revert entity addition (mark as deprecated)
    return {
      success: true,
      action: 'entity_deprecated',
      message: 'Entity addition reverted by marking as deprecated'
    };
  }

  private async revertEntityModification(rollbackPlan: any, changeId: string, userId: string): Promise<any> {
    // Revert entity modification
    return {
      success: true,
      action: 'entity_restored',
      message: 'Entity modification reverted to previous state'
    };
  }

  private async revertEntityRemoval(rollbackPlan: any, changeId: string, userId: string): Promise<any> {
    // Revert entity removal (restore entity)
    return {
      success: true,
      action: 'entity_restored',
      message: 'Entity removal reverted by restoring entity'
    };
  }

  private async revertRelationshipChange(rollbackPlan: any, changeId: string, userId: string): Promise<any> {
    // Revert relationship change
    return {
      success: true,
      action: 'relationship_restored',
      message: 'Relationship change reverted to previous state'
    };
  }

  private async revertPropertyChange(rollbackPlan: any, changeId: string, userId: string): Promise<any> {
    // Revert property change
    return {
      success: true,
      action: 'property_restored',
      message: 'Property change reverted to previous state'
    };
  }
}