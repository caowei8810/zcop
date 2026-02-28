import { Injectable } from '@nestjs/common';
import { Neo4jService } from 'nest-neo4j';

@Injectable()
export class BusinessRulesEngineService {
  constructor(private neo4jService: Neo4jService) {}

  async createBusinessRule(ruleDefinition: any): Promise<any> {
    // Validate rule definition
    const validation = this.validateRuleDefinition(ruleDefinition);
    if (!validation.isValid) {
      throw new Error(`Invalid rule definition: ${validation.errors.join(', ')}`);
    }

    const cypher = `
      CREATE (rule:BusinessRule {
        id: $id,
        name: $name,
        description: $description,
        condition: $condition,
        action: $action,
        priority: $priority,
        status: $status,
        category: $category,
        tags: $tags,
        createdAt: $createdAt,
        updatedAt: $updatedAt,
        createdBy: $createdBy
      })
      RETURN rule
    `;

    const id = `rule-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const now = new Date().toISOString();

    const result = await this.neo4jService.write(cypher, {
      id,
      name: ruleDefinition.name,
      description: ruleDefinition.description,
      condition: JSON.stringify(ruleDefinition.condition || {}),
      action: JSON.stringify(ruleDefinition.action || {}),
      priority: ruleDefinition.priority || 5, // Default to medium priority
      status: ruleDefinition.status || 'draft',
      category: ruleDefinition.category || 'general',
      tags: JSON.stringify(ruleDefinition.tags || []),
      createdAt: now,
      updatedAt: now,
      createdBy: ruleDefinition.createdBy || 'system'
    });

    return result.records[0].get('rule');
  }

  async activateBusinessRule(ruleId: string, activatedBy: string): Promise<any> {
    const cypher = `
      MATCH (rule:BusinessRule {id: $ruleId})
      WHERE rule.status IN ['draft', 'testing']
      SET rule.status = 'active',
          rule.activatedAt = $activatedAt,
          rule.activatedBy = $activatedBy,
          rule.updatedAt = $updatedAt
      RETURN rule
    `;

    const result = await this.neo4jService.write(cypher, {
      ruleId,
      activatedAt: new Date().toISOString(),
      activatedBy,
      updatedAt: new Date().toISOString()
    });

    if (result.records.length === 0) {
      throw new Error(`Rule ${ruleId} not found or not in draft/testing status`);
    }

    return result.records[0].get('rule');
  }

  async evaluateBusinessRules(entityData: any, context: any = {}): Promise<any[]> {
    // Get all active rules
    const cypher = `
      MATCH (rule:BusinessRule)
      WHERE rule.status = 'active'
      RETURN rule
      ORDER BY rule.priority DESC
    `;

    const result = await this.neo4jService.read(cypher, {});
    const rules = result.records.map(record => record.get('rule'));

    const triggeredRules = [];

    // Evaluate each rule against the entity data
    for (const rule of rules) {
      try {
        const ruleCondition = JSON.parse(rule.condition);
        const isMatch = this.evaluateCondition(ruleCondition, entityData, context);

        if (isMatch) {
          triggeredRules.push({
            ruleId: rule.id,
            ruleName: rule.name,
            action: JSON.parse(rule.action),
            priority: rule.priority,
            matchedAt: new Date().toISOString()
          });
        }
      } catch (error) {
        console.error(`Error evaluating rule ${rule.id}:`, error);
      }
    }

    return triggeredRules;
  }

  async executeRuleAction(ruleId: string, entityData: any, context: any = {}): Promise<any> {
    // Get the rule
    const rule = await this.getBusinessRule(ruleId);
    if (!rule || rule.status !== 'active') {
      throw new Error(`Rule ${ruleId} not found or not active`);
    }

    const action = JSON.parse(rule.action);
    const condition = JSON.parse(rule.condition);

    // Check if condition is met
    const isConditionMet = this.evaluateCondition(condition, entityData, context);
    if (!isConditionMet) {
      throw new Error(`Rule ${ruleId} condition not met for provided data`);
    }

    // Execute the action
    const result = await this.performAction(action, entityData, context);

    // Log the rule execution
    await this.logRuleExecution(ruleId, entityData, result, context);

    return result;
  }

  async getBusinessRule(ruleId: string): Promise<any> {
    const cypher = `
      MATCH (rule:BusinessRule {id: $ruleId})
      RETURN rule
    `;

    const result = await this.neo4jService.read(cypher, { ruleId });
    return result.records.length > 0 ? result.records[0].get('rule') : null;
  }

  async getBusinessRules(filter: any = {}): Promise<any[]> {
    let whereClause = '';
    const params: any = {};

    if (filter.status) {
      whereClause = 'WHERE rule.status = $status ';
      params.status = filter.status;
    }

    if (filter.category) {
      if (whereClause) whereClause += 'AND ';
      else whereClause = 'WHERE ';
      whereClause += 'rule.category = $category ';
      params.category = filter.category;
    }

    if (filter.priority) {
      if (whereClause) whereClause += 'AND ';
      else whereClause = 'WHERE ';
      whereClause += 'rule.priority = $priority ';
      params.priority = filter.priority;
    }

    const cypher = `
      MATCH (rule:BusinessRule)
      ${whereClause}
      RETURN rule
      ORDER BY rule.priority DESC, rule.createdAt DESC
    `;

    const result = await this.neo4jService.read(cypher, params);
    return result.records.map(record => record.get('rule'));
  }

  async updateBusinessRule(ruleId: string, updates: any): Promise<any> {
    // Check if rule can be updated (only draft and testing rules)
    const rule = await this.getBusinessRule(ruleId);
    if (!rule || !['draft', 'testing'].includes(rule.status)) {
      throw new Error(`Cannot update rule ${ruleId} - only draft and testing rules can be updated`);
    }

    const cypher = `
      MATCH (rule:BusinessRule {id: $ruleId})
      SET rule += $updates,
          rule.updatedAt = $updatedAt
      RETURN rule
    `;

    const updatesWithTimestamp = {
      ...updates,
      updatedAt: new Date().toISOString()
    };

    const result = await this.neo4jService.write(cypher, {
      ruleId,
      updates: updatesWithTimestamp,
      updatedAt: new Date().toISOString()
    });

    return result.records[0].get('rule');
  }

  async deactivateBusinessRule(ruleId: string, deactivatedBy: string): Promise<any> {
    const cypher = `
      MATCH (rule:BusinessRule {id: $ruleId})
      WHERE rule.status = 'active'
      SET rule.status = 'inactive',
          rule.deactivatedAt = $deactivatedAt,
          rule.deactivatedBy = $deactivatedBy,
          rule.updatedAt = $updatedAt
      RETURN rule
    `;

    const result = await this.neo4jService.write(cypher, {
      ruleId,
      deactivatedAt: new Date().toISOString(),
      deactivatedBy,
      updatedAt: new Date().toISOString()
    });

    if (result.records.length === 0) {
      throw new Error(`Rule ${ruleId} not found or not active`);
    }

    return result.records[0].get('rule');
  }

  async deleteBusinessRule(ruleId: string): Promise<any> {
    const rule = await this.getBusinessRule(ruleId);
    if (!rule) {
      throw new Error(`Rule ${ruleId} not found`);
    }

    if (rule.status === 'active') {
      throw new Error(`Cannot delete active rule ${ruleId}. Deactivate first.`);
    }

    const cypher = `
      MATCH (rule:BusinessRule {id: $ruleId})
      DETACH DELETE rule
    `;

    await this.neo4jService.write(cypher, { ruleId });

    return { success: true, message: `Rule ${ruleId} deleted successfully` };
  }

  async testBusinessRule(ruleId: string, testData: any, testContext: any = {}): Promise<any> {
    const rule = await this.getBusinessRule(ruleId);
    if (!rule) {
      throw new Error(`Rule ${ruleId} not found`);
    }

    const condition = JSON.parse(rule.condition);
    const action = JSON.parse(rule.action);

    // Evaluate condition
    const isMatch = this.evaluateCondition(condition, testData, testContext);

    // If condition matches, simulate action
    let actionResult = null;
    if (isMatch) {
      try {
        actionResult = await this.performAction(action, testData, testContext);
      } catch (error) {
        actionResult = { error: error.message };
      }
    }

    return {
      ruleId,
      testName: rule.name,
      conditionMatch: isMatch,
      actionResult,
      testData,
      testContext,
      testedAt: new Date().toISOString()
    };
  }

  async getRuleExecutionHistory(ruleId?: string, filter: any = {}): Promise<any[]> {
    let whereClause = ruleId ? 'WHERE exec.ruleId = $ruleId ' : '';
    const params: any = ruleId ? { ruleId } : {};

    if (filter.startDate) {
      whereClause += whereClause ? 'AND ' : 'WHERE ';
      whereClause += 'exec.executedAt >= $startDate ';
      params.startDate = filter.startDate;
    }

    if (filter.endDate) {
      whereClause += whereClause ? 'AND ' : 'WHERE ';
      whereClause += 'exec.executedAt <= $endDate ';
      params.endDate = filter.endDate;
    }

    if (filter.status) {
      whereClause += whereClause ? 'AND ' : 'WHERE ';
      whereClause += 'exec.status = $status ';
      params.status = filter.status;
    }

    const cypher = `
      MATCH (exec:RuleExecution)
      ${whereClause}
      RETURN exec
      ORDER BY exec.executedAt DESC
    `;

    const result = await this.neo4jService.read(cypher, params);
    return result.records.map(record => record.get('exec'));
  }

  private evaluateCondition(condition: any, entityData: any, context: any): boolean {
    // Handle different types of conditions
    switch (condition.type) {
      case 'simple':
        return this.evaluateSimpleCondition(condition, entityData, context);
      case 'compound':
        return this.evaluateCompoundCondition(condition, entityData, context);
      case 'complex':
        return this.evaluateComplexCondition(condition, entityData, context);
      case 'expression':
        return this.evaluateExpressionCondition(condition, entityData, context);
      default:
        return false;
    }
  }

  private evaluateSimpleCondition(condition: any, entityData: any, context: any): boolean {
    const leftValue = this.extractValue(condition.left, entityData, context);
    const rightValue = this.extractValue(condition.right, entityData, context);

    switch (condition.operator) {
      case 'equals':
        return leftValue === rightValue;
      case 'notEquals':
        return leftValue !== rightValue;
      case 'greaterThan':
        return leftValue > rightValue;
      case 'lessThan':
        return leftValue < rightValue;
      case 'greaterThanOrEqual':
        return leftValue >= rightValue;
      case 'lessThanOrEqual':
        return leftValue <= rightValue;
      case 'contains':
        return String(leftValue).includes(String(rightValue));
      case 'startsWith':
        return String(leftValue).startsWith(String(rightValue));
      case 'endsWith':
        return String(leftValue).endsWith(String(rightValue));
      case 'in':
        return Array.isArray(rightValue) && rightValue.includes(leftValue);
      case 'notIn':
        return Array.isArray(rightValue) && !rightValue.includes(leftValue);
      default:
        return false;
    }
  }

  private evaluateCompoundCondition(condition: any, entityData: any, context: any): boolean {
    const results = condition.conditions.map((subCondition: any) =>
      this.evaluateCondition(subCondition, entityData, context)
    );

    switch (condition.operator) {
      case 'and':
        return results.every(r => r);
      case 'or':
        return results.some(r => r);
      case 'xor':
        return results.filter(r => r).length % 2 === 1;
      default:
        return false;
    }
  }

  private evaluateComplexCondition(condition: any, entityData: any, context: any): boolean {
    // Complex conditions might involve multiple entities or complex logic
    // For now, we'll delegate to the simple and compound evaluators
    return this.evaluateCondition(condition.subCondition, entityData, context);
  }

  private evaluateExpressionCondition(condition: any, entityData: any, context: any): boolean {
    // Evaluate a condition expressed as a formula or expression
    // This is a simplified implementation - a full implementation would require a proper expression parser
    const expression = condition.expression;
    try {
      // In a real implementation, we would use a secure expression evaluator
      // For now, we'll just return true for demonstration purposes
      return true;
    } catch (error) {
      console.error('Error evaluating expression:', error);
      return false;
    }
  }

  private extractValue(source: any, entityData: any, context: any): any {
    if (typeof source === 'string') {
      // If it looks like a path (contains dots), extract from entityData
      if (source.includes('.')) {
        return this.getNestedValue(entityData, source);
      }
      // Otherwise, it might be a literal value or a context reference
      return entityData[source] || context[source] || source;
    } else if (typeof source === 'object') {
      // Handle object references
      if (source.path) {
        return this.getNestedValue(entityData, source.path);
      } else if (source.context) {
        return context[source.context];
      }
    }
    return source;
  }

  private async performAction(action: any, entityData: any, context: any): Promise<any> {
    switch (action.type) {
      case 'set_property':
        return await this.performSetPropertyAction(action, entityData, context);
      case 'call_api':
        return await this.performCallApiAction(action, entityData, context);
      case 'send_notification':
        return await this.performSendNotificationAction(action, entityData, context);
      case 'create_entity':
        return await this.performCreateEntityAction(action, entityData, context);
      case 'update_entity':
        return await this.performUpdateEntityAction(action, entityData, context);
      case 'delete_entity':
        return await this.performDeleteEntityAction(action, entityData, context);
      case 'trigger_workflow':
        return await this.performTriggerWorkflowAction(action, entityData, context);
      case 'execute_custom_logic':
        return await this.performExecuteCustomLogicAction(action, entityData, context);
      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  private async performSetPropertyAction(action: any, entityData: any, context: any): Promise<any> {
    // In a real system, this would update the entity in the database
    // For now, we'll just return the intended change
    return {
      action: 'setProperty',
      entity: action.targetEntity || 'current',
      property: action.property,
      newValue: this.extractValue(action.value, entityData, context),
      oldValue: entityData[action.property]
    };
  }

  private async performCallApiAction(action: any, entityData: any, context: any): Promise<any> {
    // Simulate calling an external API
    // In a real implementation, this would make the actual API call
    return {
      action: 'callApi',
      url: this.interpolateString(action.url, { ...entityData, ...context }),
      method: action.method || 'GET',
      payload: this.interpolateObject(action.payload, { ...entityData, ...context }),
      executed: true
    };
  }

  private async performSendNotificationAction(action: any, entityData: any, context: any): Promise<any> {
    // Simulate sending a notification
    return {
      action: 'sendNotification',
      type: action.notificationType || 'email',
      recipients: this.interpolateArray(action.recipients, { ...entityData, ...context }),
      subject: this.interpolateString(action.subject, { ...entityData, ...context }),
      message: this.interpolateString(action.message, { ...entityData, ...context }),
      sent: true
    };
  }

  private async performCreateEntityAction(action: any, entityData: any, context: any): Promise<any> {
    // Simulate creating a new entity
    return {
      action: 'createEntity',
      entityType: action.entityType,
      properties: this.interpolateObject(action.properties, { ...entityData, ...context }),
      created: true
    };
  }

  private async performUpdateEntityAction(action: any, entityData: any, context: any): Promise<any> {
    // Simulate updating an entity
    return {
      action: 'updateEntity',
      entityType: action.entityType,
      entityId: this.interpolateString(action.entityId, { ...entityData, ...context }),
      properties: this.interpolateObject(action.properties, { ...entityData, ...context }),
      updated: true
    };
  }

  private async performDeleteEntityAction(action: any, entityData: any, context: any): Promise<any> {
    // Simulate deleting an entity
    return {
      action: 'deleteEntity',
      entityType: action.entityType,
      entityId: this.interpolateString(action.entityId, { ...entityData, ...context }),
      deleted: true
    };
  }

  private async performTriggerWorkflowAction(action: any, entityData: any, context: any): Promise<any> {
    // Simulate triggering a workflow
    return {
      action: 'triggerWorkflow',
      workflowId: action.workflowId,
      inputData: this.interpolateObject(action.inputData, { ...entityData, ...context }),
      triggered: true
    };
  }

  private async performExecuteCustomLogicAction(action: any, entityData: any, context: any): Promise<any> {
    // Execute custom business logic
    // This would typically call an external service or function
    return {
      action: 'executeCustomLogic',
      functionName: action.functionName,
      parameters: this.interpolateObject(action.parameters, { ...entityData, ...context }),
      executed: true
    };
  }

  private interpolateString(template: string, variables: any): string {
    if (!template || typeof template !== 'string') return template;

    return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
      const value = this.getNestedValue(variables, path.trim());
      return value !== undefined ? String(value) : match;
    });
  }

  private interpolateObject(obj: any, variables: any): any {
    if (obj === null || typeof obj !== 'object') {
      return typeof obj === 'string' ? this.interpolateString(obj, variables) : obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.interpolateObject(item, variables));
    }

    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = this.interpolateObject(value, variables);
    }
    return result;
  }

  private interpolateArray(arr: any[], variables: any): any[] {
    return arr.map(item => this.interpolateObject(item, variables));
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current && current[key], obj);
  }

  private async logRuleExecution(ruleId: string, entityData: any, result: any, context: any): Promise<void> {
    const cypher = `
      MATCH (rule:BusinessRule {id: $ruleId})
      CREATE (exec:RuleExecution {
        id: $execId,
        ruleId: $ruleId,
        entityData: $entityData,
        context: $context,
        result: $result,
        executedAt: $executedAt,
        status: $status
      })
      CREATE (rule)-[:HAS_EXECUTION]->(exec)
    `;

    await this.neo4jService.write(cypher, {
      execId: `exec-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      ruleId,
      entityData: JSON.stringify(entityData),
      context: JSON.stringify(context),
      result: JSON.stringify(result),
      executedAt: new Date().toISOString(),
      status: 'completed'
    });
  }

  private validateRuleDefinition(definition: any): { isValid: boolean; errors: string[] } {
    const errors = [];

    if (!definition.name) {
      errors.push('Rule name is required');
    }

    if (!definition.condition) {
      errors.push('Rule condition is required');
    }

    if (!definition.action) {
      errors.push('Rule action is required');
    }

    if (definition.priority !== undefined && (definition.priority < 1 || definition.priority > 10)) {
      errors.push('Rule priority must be between 1 and 10');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}