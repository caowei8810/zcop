import { Injectable } from '@nestjs/common';
import { WorkflowEngine } from '../workflow/graph-engine';

@Injectable()
export class WorkflowService {
  constructor(private workflowEngine: WorkflowEngine) {}

  async createWorkflow(workflowDefinition: any): Promise<any> {
    // Validate workflow definition
    const validation = this.validateWorkflowDefinition(workflowDefinition);
    if (!validation.valid) {
      throw new Error(`Invalid workflow definition: ${validation.errors.join(', ')}`);
    }

    // Store workflow definition
    const workflowId = await this.workflowEngine.createWorkflow(workflowDefinition);
    
    return {
      id: workflowId,
      definition: workflowDefinition,
      status: 'created',
      createdAt: new Date(),
    };
  }

  async executeWorkflow(workflowId: string, inputData: any): Promise<any> {
    try {
      // Execute the workflow
      const result = await this.workflowEngine.executeWorkflow(workflowId, inputData);
      
      return {
        workflowId,
        status: 'completed',
        result,
        executedAt: new Date(),
      };
    } catch (error) {
      return {
        workflowId,
        status: 'failed',
        error: error.message,
        executedAt: new Date(),
      };
    }
  }

  async getWorkflowStatus(workflowId: string): Promise<any> {
    return await this.workflowEngine.getWorkflowStatus(workflowId);
  }

  async listWorkflows(filters: any = {}): Promise<any[]> {
    return await this.workflowEngine.listWorkflows(filters);
  }

  async updateWorkflow(workflowId: string, workflowDefinition: any): Promise<any> {
    // Validate workflow definition
    const validation = this.validateWorkflowDefinition(workflowDefinition);
    if (!validation.valid) {
      throw new Error(`Invalid workflow definition: ${validation.errors.join(', ')}`);
    }

    // Update workflow
    await this.workflowEngine.updateWorkflow(workflowId, workflowDefinition);
    
    return {
      id: workflowId,
      definition: workflowDefinition,
      status: 'updated',
      updatedAt: new Date(),
    };
  }

  async deleteWorkflow(workflowId: string): Promise<boolean> {
    return await this.workflowEngine.deleteWorkflow(workflowId);
  }

  async pauseWorkflow(workflowId: string): Promise<boolean> {
    return await this.workflowEngine.pauseWorkflow(workflowId);
  }

  async resumeWorkflow(workflowId: string): Promise<boolean> {
    return await this.workflowEngine.resumeWorkflow(workflowId);
  }

  async cancelWorkflow(workflowId: string): Promise<boolean> {
    return await this.workflowEngine.cancelWorkflow(workflowId);
  }

  private validateWorkflowDefinition(definition: any): { valid: boolean; errors: string[] } {
    const errors = [];

    if (!definition.name) {
      errors.push('Workflow name is required');
    }

    if (!definition.steps || !Array.isArray(definition.steps) || definition.steps.length === 0) {
      errors.push('Workflow must have at least one step');
    }

    if (definition.steps) {
      for (let i = 0; i < definition.steps.length; i++) {
        const step = definition.steps[i];
        if (!step.id) {
          errors.push(`Step ${i} must have an ID`);
        }
        if (!step.type) {
          errors.push(`Step ${i} must have a type`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  async generateWorkflowFromOntology(ontology: any): Promise<any> {
    // Generate common workflows based on ontology
    const workflowSteps = [];

    // Add CRUD operations for each entity
    if (ontology.entities) {
      for (const entity of ontology.entities) {
        // Create operation
        workflowSteps.push({
          id: `create_${entity.name.toLowerCase()}`,
          type: 'action',
          name: `Create ${entity.name}`,
          description: `Create a new ${entity.name} instance`,
          inputs: entity.properties?.map(prop => ({
            name: prop.name,
            type: prop.type,
            required: prop.required || false,
          })) || [],
          outputs: [{ name: 'id', type: 'string' }],
        });

        // Read operation
        workflowSteps.push({
          id: `read_${entity.name.toLowerCase()}`,
          type: 'action',
          name: `Read ${entity.name}`,
          description: `Retrieve ${entity.name} instance(s)`,
          inputs: [{ name: 'id', type: 'string', required: false }],
          outputs: [{ name: 'data', type: 'object' }],
        });

        // Update operation
        workflowSteps.push({
          id: `update_${entity.name.toLowerCase()}`,
          type: 'action',
          name: `Update ${entity.name}`,
          description: `Update ${entity.name} instance`,
          inputs: [
            { name: 'id', type: 'string', required: true },
            ...(entity.properties?.map(prop => ({
              name: prop.name,
              type: prop.type,
              required: false,
            })) || []),
          ],
          outputs: [{ name: 'success', type: 'boolean' }],
        });

        // Delete operation
        workflowSteps.push({
          id: `delete_${entity.name.toLowerCase()}`,
          type: 'action',
          name: `Delete ${entity.name}`,
          description: `Delete ${entity.name} instance`,
          inputs: [{ name: 'id', type: 'string', required: true }],
          outputs: [{ name: 'success', type: 'boolean' }],
        });
      }
    }

    // Add relationship operations
    if (ontology.relationships) {
      for (const rel of ontology.relationships) {
        workflowSteps.push({
          id: `create_${rel.name.toLowerCase()}_relation`,
          type: 'action',
          name: `Create ${rel.name} Relationship`,
          description: `Create a relationship between ${rel.fromEntity} and ${rel.toEntity}`,
          inputs: [
            { name: `${rel.fromEntity.toLowerCase()}Id`, type: 'string', required: true },
            { name: `${rel.toEntity.toLowerCase()}Id`, type: 'string', required: true },
          ],
          outputs: [{ name: 'success', type: 'boolean' }],
        });
      }
    }

    // Add business rule workflows
    if (ontology.rules) {
      for (const rule of ontology.rules) {
        workflowSteps.push({
          id: `execute_${rule.name.toLowerCase()}_rule`,
          type: 'rule',
          name: `Execute ${rule.name} Rule`,
          description: rule.description,
          inputs: [],
          outputs: [{ name: 'triggered', type: 'boolean' }],
        });
      }
    }

    return {
      name: `${ontology.name || 'Generated'} Workflow`,
      description: `Automatically generated workflow for ${ontology.name || 'the ontology'}`,
      steps: workflowSteps,
      triggers: ['manual', 'schedule', 'event'],
      status: 'draft',
    };
  }

  async simulateWorkflow(workflowId: string, inputData: any): Promise<any> {
    // Simulate workflow execution without actually executing it
    return await this.workflowEngine.simulateWorkflow(workflowId, inputData);
  }

  async getWorkflowMetrics(workflowId: string, timeRange: { start: Date; end: Date }): Promise<any> {
    // Get metrics for a workflow
    return await this.workflowEngine.getWorkflowMetrics(workflowId, timeRange);
  }
}