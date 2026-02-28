import { Injectable } from '@nestjs/common';
import { Neo4jService } from 'nest-neo4j';

@Injectable()
export class WorkflowOrchestrationService {
  constructor(private neo4jService: Neo4jService) {}

  async createWorkflow(workflowDefinition: any): Promise<any> {
    // Validate workflow definition
    const validation = this.validateWorkflowDefinition(workflowDefinition);
    if (!validation.isValid) {
      throw new Error(`Invalid workflow definition: ${validation.errors.join(', ')}`);
    }

    // Create workflow node
    const cypher = `
      CREATE (w:Workflow {
        id: $id,
        name: $name,
        description: $description,
        status: $status,
        createdAt: $createdAt,
        updatedAt: $updatedAt,
        definition: $definition,
        triggers: $triggers,
        tasks: $tasks,
        conditions: $conditions
      })
      RETURN w
    `;

    const id = `wf-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const now = new Date().toISOString();

    const result = await this.neo4jService.write(cypher, {
      id,
      name: workflowDefinition.name,
      description: workflowDefinition.description,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
      definition: JSON.stringify(workflowDefinition),
      triggers: JSON.stringify(workflowDefinition.triggers || []),
      tasks: JSON.stringify(workflowDefinition.tasks || []),
      conditions: JSON.stringify(workflowDefinition.conditions || [])
    });

    // Create task nodes and relationships
    await this.createWorkflowTasks(id, workflowDefinition.tasks);

    return result.records[0].get('w');
  }

  async publishWorkflow(workflowId: string): Promise<any> {
    // Check if workflow is valid before publishing
    const validation = await this.validatePublishedWorkflow(workflowId);
    if (!validation.isValid) {
      throw new Error(`Cannot publish workflow: ${validation.errors.join(', ')}`);
    }

    const cypher = `
      MATCH (w:Workflow {id: $workflowId})
      WHERE w.status IN ['draft', 'testing']
      SET w.status = 'published',
          w.publishedAt = $publishedAt,
          w.updatedAt = $updatedAt
      RETURN w
    `;

    const result = await this.neo4jService.write(cypher, {
      workflowId,
      publishedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    return result.records[0].get('w');
  }

  async executeWorkflow(workflowId: string, inputData: any): Promise<any> {
    // Get workflow definition
    const workflow = await this.getWorkflow(workflowId);
    if (!workflow || workflow.status !== 'published') {
      throw new Error(`Workflow ${workflowId} not found or not published`);
    }

    // Create workflow execution instance
    const executionId = `exec-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const now = new Date().toISOString();

    const executionCypher = `
      CREATE (exec:WorkflowExecution {
        id: $executionId,
        workflowId: $workflowId,
        status: $status,
        inputData: $inputData,
        startedAt: $startedAt,
        currentTask: $currentTask
      })
      RETURN exec
    `;

    const executionResult = await this.neo4jService.write(executionCypher, {
      executionId,
      workflowId,
      status: 'running',
      inputData: JSON.stringify(inputData),
      startedAt: now,
      currentTask: workflow.tasks[0]?.id || null
    });

    // Execute tasks in sequence
    const execution = executionResult.records[0].get('exec');
    const result = await this.executeWorkflowTasks(executionId, workflow.tasks, inputData);

    // Update execution status
    const finalStatus = result.success ? 'completed' : 'failed';
    await this.updateExecutionStatus(executionId, finalStatus, result.output);

    return {
      executionId,
      workflowId,
      status: finalStatus,
      output: result.output,
      completedAt: new Date().toISOString()
    };
  }

  async getWorkflow(workflowId: string): Promise<any> {
    const cypher = `
      MATCH (w:Workflow {id: $workflowId})
      OPTIONAL MATCH (w)-[:HAS_TASK]->(task:WorkflowTask)
      RETURN w, collect(task) AS tasks
    `;

    const result = await this.neo4jService.read(cypher, { workflowId });
    if (result.records.length === 0) return null;

    const record = result.records[0];
    const workflow = record.get('w');
    const tasks = record.get('tasks');

    return {
      ...workflow,
      tasks: tasks.map((t: any) => t.properties)
    };
  }

  async getWorkflows(filter: any = {}): Promise<any[]> {
    let whereClause = '';
    const params: any = {};

    if (filter.status) {
      whereClause = 'WHERE w.status = $status ';
      params.status = filter.status;
    }

    const cypher = `
      MATCH (w:Workflow)
      ${whereClause}
      RETURN w
      ORDER BY w.createdAt DESC
    `;

    const result = await this.neo4jService.read(cypher, params);
    return result.records.map(record => record.get('w'));
  }

  async updateWorkflow(workflowId: string, updates: any): Promise<any> {
    // Check if workflow can be updated (only draft and testing workflows)
    const workflow = await this.getWorkflow(workflowId);
    if (!workflow || !['draft', 'testing'].includes(workflow.status)) {
      throw new Error(`Cannot update workflow ${workflowId} - only draft and testing workflows can be updated`);
    }

    const cypher = `
      MATCH (w:Workflow {id: $workflowId})
      SET w += $updates,
          w.updatedAt = $updatedAt
      RETURN w
    `;

    const updatesWithTimestamp = {
      ...updates,
      updatedAt: new Date().toISOString()
    };

    const result = await this.neo4jService.write(cypher, {
      workflowId,
      updates: updatesWithTimestamp,
      updatedAt: new Date().toISOString()
    });

    return result.records[0].get('w');
  }

  async deleteWorkflow(workflowId: string): Promise<any> {
    // Only delete draft workflows
    const workflow = await this.getWorkflow(workflowId);
    if (!workflow || workflow.status !== 'draft') {
      throw new Error(`Cannot delete workflow ${workflowId} - only draft workflows can be deleted`);
    }

    const cypher = `
      MATCH (w:Workflow {id: $workflowId})
      DETACH DELETE w
    `;

    await this.neo4jService.write(cypher, { workflowId });

    return { success: true, message: `Workflow ${workflowId} deleted successfully` };
  }

  async getWorkflowExecutions(workflowId?: string, filter: any = {}): Promise<any[]> {
    let whereClause = workflowId ? 'WHERE exec.workflowId = $workflowId ' : '';
    const params: any = workflowId ? { workflowId } : {};

    if (filter.status) {
      whereClause += whereClause ? 'AND ' : 'WHERE ';
      whereClause += 'exec.status = $status ';
      params.status = filter.status;
    }

    const cypher = `
      MATCH (exec:WorkflowExecution)
      ${whereClause}
      RETURN exec
      ORDER BY exec.startedAt DESC
    `;

    const result = await this.neo4jService.read(cypher, params);
    return result.records.map(record => record.get('exec'));
  }

  async cancelWorkflowExecution(executionId: string): Promise<any> {
    const cypher = `
      MATCH (exec:WorkflowExecution {id: $executionId})
      WHERE exec.status = 'running'
      SET exec.status = 'cancelled',
          exec.cancelledAt = $cancelledAt
      RETURN exec
    `;

    const result = await this.neo4jService.write(cypher, {
      executionId,
      cancelledAt: new Date().toISOString()
    });

    if (result.records.length === 0) {
      throw new Error(`Running execution ${executionId} not found`);
    }

    return result.records[0].get('exec');
  }

  private async createWorkflowTasks(workflowId: string, tasks: any[]): Promise<void> {
    for (const task of tasks) {
      const taskCypher = `
        MATCH (w:Workflow {id: $workflowId})
        CREATE (t:WorkflowTask {
          id: $taskId,
          workflowId: $workflowId,
          name: $name,
          description: $description,
          type: $type,
          config: $config,
          createdAt: $createdAt
        })
        CREATE (w)-[:HAS_TASK]->(t)
        RETURN t
      `;

      await this.neo4jService.write(taskCypher, {
        workflowId,
        taskId: task.id || `task-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        name: task.name,
        description: task.description,
        type: task.type,
        config: JSON.stringify(task.config || {}),
        createdAt: new Date().toISOString()
      });
    }
  }

  private async executeWorkflowTasks(executionId: string, tasks: any[], inputData: any): Promise<any> {
    let currentData = inputData;
    let lastResult = null;

    for (const task of tasks) {
      try {
        // Execute the task
        const taskResult = await this.executeTask(task, currentData);
        
        // Update execution with current task result
        await this.updateCurrentTask(executionId, task.id, taskResult);
        
        // Update data for next task
        currentData = { ...currentData, [task.id]: taskResult, ...taskResult };
        lastResult = taskResult;
      } catch (error) {
        // Log error and potentially handle failure based on workflow configuration
        await this.logTaskFailure(executionId, task.id, error.message);
        
        // If task is marked as critical, stop execution
        if (task.critical) {
          return { success: false, output: currentData, error: error.message };
        }
      }
    }

    return { success: true, output: currentData };
  }

  private async executeTask(task: any, inputData: any): Promise<any> {
    switch (task.type) {
      case 'data_transformation':
        return await this.executeDataTransformationTask(task, inputData);
      case 'api_call':
        return await this.executeApiCallTask(task, inputData);
      case 'conditional_logic':
        return await this.executeConditionalTask(task, inputData);
      case 'approval':
        return await this.executeApprovalTask(task, inputData);
      case 'notification':
        return await this.executeNotificationTask(task, inputData);
      case 'data_validation':
        return await this.executeDataValidationTask(task, inputData);
      default:
        throw new Error(`Unknown task type: ${task.type}`);
    }
  }

  private async executeDataTransformationTask(task: any, inputData: any): Promise<any> {
    // Apply transformations defined in task config
    const transformations = task.config.transformations || [];
    let result = { ...inputData };

    for (const transform of transformations) {
      switch (transform.operation) {
        case 'addField':
          result[transform.field] = this.evaluateExpression(transform.value, inputData);
          break;
        case 'removeField':
          delete result[transform.field];
          break;
        case 'renameField':
          result[transform.newName] = result[transform.oldName];
          delete result[transform.oldName];
          break;
        case 'updateField':
          result[transform.field] = this.evaluateExpression(transform.value, result);
          break;
        default:
          console.warn(`Unknown transformation operation: ${transform.operation}`);
      }
    }

    return result;
  }

  private async executeApiCallTask(task: any, inputData: any): Promise<any> {
    // In a real implementation, this would make an actual API call
    // For now, we'll simulate the call
    const url = this.evaluateExpression(task.config.url, inputData);
    const method = task.config.method || 'GET';
    const headers = this.evaluateExpression(task.config.headers || {}, inputData);
    const body = this.evaluateExpression(task.config.body || {}, inputData);

    // Simulate API call result
    return {
      statusCode: 200,
      data: { simulated: true, url, method, received: body },
      headers
    };
  }

  private async executeConditionalTask(task: any, inputData: any): Promise<any> {
    const condition = task.config.condition;
    const result = this.evaluateCondition(condition, inputData);
    
    return {
      condition: condition,
      result: result,
      branch: result ? 'true' : 'false'
    };
  }

  private async executeApprovalTask(task: any, inputData: any): Promise<any> {
    // Create an approval request that needs human intervention
    const approvalId = `app-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    
    return {
      approvalId,
      status: 'pending',
      task: task.name,
      data: inputData,
      requestedApprovals: task.config.approvers || [],
      deadline: new Date(Date.now() + (task.config.deadlineHours || 24) * 60 * 60 * 1000).toISOString()
    };
  }

  private async executeNotificationTask(task: any, inputData: any): Promise<any> {
    // Simulate sending notification
    const notification = {
      type: task.config.type || 'email',
      recipients: this.evaluateExpression(task.config.recipients, inputData),
      subject: this.evaluateExpression(task.config.subject, inputData),
      message: this.evaluateExpression(task.config.message, inputData),
      sentAt: new Date().toISOString()
    };

    return { notification, status: 'sent' };
  }

  private async executeDataValidationTask(task: any, inputData: any): Promise<any> {
    const validationResult = {
      valid: true,
      errors: []
    };

    const rules = task.config.rules || [];
    for (const rule of rules) {
      const value = this.getNestedValue(inputData, rule.field);
      const isValid = this.validateValue(value, rule);
      
      if (!isValid) {
        validationResult.valid = false;
        validationResult.errors.push({
          field: rule.field,
          rule: rule.rule,
          value: value,
          message: rule.errorMessage || `Validation failed for ${rule.field}`
        });
      }
    }

    return validationResult;
  }

  private evaluateExpression(expression: any, context: any): any {
    // Simple expression evaluator - in reality, this would be more sophisticated
    if (typeof expression === 'string') {
      // Handle template strings like "{{user.name}}"
      return expression.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
        return this.getNestedValue(context, path.trim()) || match;
      });
    }
    return expression;
  }

  private evaluateCondition(condition: any, context: any): boolean {
    const left = this.evaluateExpression(condition.left, context);
    const right = this.evaluateExpression(condition.right, context);
    
    switch (condition.operator) {
      case 'equals':
        return left === right;
      case 'notEquals':
        return left !== right;
      case 'greaterThan':
        return left > right;
      case 'lessThan':
        return left < right;
      case 'greaterThanOrEqual':
        return left >= right;
      case 'lessThanOrEqual':
        return left <= right;
      case 'contains':
        return String(left).includes(String(right));
      case 'startsWith':
        return String(left).startsWith(String(right));
      case 'endsWith':
        return String(left).endsWith(String(right));
      default:
        return false;
    }
  }

  private validateValue(value: any, rule: any): boolean {
    switch (rule.rule) {
      case 'required':
        return value !== null && value !== undefined && value !== '';
      case 'email':
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return typeof value === 'string' && emailRegex.test(value);
      case 'minLength':
        return String(value).length >= rule.minLength;
      case 'maxLength':
        return String(value).length <= rule.maxLength;
      case 'minValue':
        return Number(value) >= rule.minValue;
      case 'maxValue':
        return Number(value) <= rule.maxValue;
      case 'pattern':
        const patternRegex = new RegExp(rule.pattern);
        return patternRegex.test(String(value));
      case 'enum':
        return Array.isArray(rule.values) && rule.values.includes(value);
      default:
        return true;
    }
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current && current[key], obj);
  }

  private async updateExecutionStatus(executionId: string, status: string, output: any): Promise<void> {
    const cypher = `
      MATCH (exec:WorkflowExecution {id: $executionId})
      SET exec.status = $status,
          exec.output = $output,
          exec.completedAt = $completedAt
    `;

    await this.neo4jService.write(cypher, {
      executionId,
      status,
      output: JSON.stringify(output),
      completedAt: new Date().toISOString()
    });
  }

  private async updateCurrentTask(executionId: string, taskId: string, result: any): Promise<void> {
    const cypher = `
      MATCH (exec:WorkflowExecution {id: $executionId})
      SET exec.currentTask = $taskId,
          exec.lastTaskResult = $result
    `;

    await this.neo4jService.write(cypher, {
      executionId,
      taskId,
      result: JSON.stringify(result)
    });
  }

  private async logTaskFailure(executionId: string, taskId: string, error: string): Promise<void> {
    const cypher = `
      MATCH (exec:WorkflowExecution {id: $executionId})
      CREATE (error:TaskError {
        id: $errorId,
        executionId: $executionId,
        taskId: $taskId,
        error: $error,
        timestamp: $timestamp
      })
      CREATE (exec)-[:HAS_ERROR]->(error)
    `;

    await this.neo4jService.write(cypher, {
      errorId: `err-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      executionId,
      taskId,
      error,
      timestamp: new Date().toISOString()
    });
  }

  private validateWorkflowDefinition(definition: any): { isValid: boolean; errors: string[] } {
    const errors = [];

    if (!definition.name) {
      errors.push('Workflow name is required');
    }

    if (!definition.tasks || !Array.isArray(definition.tasks) || definition.tasks.length === 0) {
      errors.push('At least one task is required');
    }

    if (definition.tasks) {
      for (let i = 0; i < definition.tasks.length; i++) {
        const task = definition.tasks[i];
        if (!task.id) {
          errors.push(`Task ${i} must have an ID`);
        }
        if (!task.name) {
          errors.push(`Task ${i} must have a name`);
        }
        if (!task.type) {
          errors.push(`Task ${i} must have a type`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private async validatePublishedWorkflow(workflowId: string): Promise<{ isValid: boolean; errors: string[] }> {
    const workflow = await this.getWorkflow(workflowId);
    const errors = [];

    if (!workflow) {
      errors.push('Workflow not found');
      return { isValid: false, errors };
    }

    // Check that all tasks are properly configured
    if (workflow.tasks) {
      for (const task of workflow.tasks) {
        if (task.type === 'api_call' && !task.config.url) {
          errors.push(`Task ${task.name} requires a URL configuration`);
        }
        if (task.type === 'conditional_logic' && !task.config.condition) {
          errors.push(`Task ${task.name} requires a condition configuration`);
        }
      }
    }

    // Additional validation for published workflows
    if (!workflow.description) {
      errors.push('Description is required for published workflows');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}