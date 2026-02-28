import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { AgentsService } from '../services/agents.service';
import { WorkflowDefinition } from '../entities/workflow-definition.entity';
import { AgentSession } from '../entities/agent-session.entity';
import { WorkflowExecution } from '../entities/workflow-execution.entity';
import { CreateWorkflowDto } from '../dto/create-workflow.dto';
import { UpdateWorkflowDto } from '../dto/update-workflow.dto';

@Resolver(() => WorkflowDefinition)
export class AgentsResolver {
  constructor(private readonly agentsService: AgentsService) {}

  @Query(() => [WorkflowDefinition], { name: 'workflows' })
  findAllWorkflows(): Promise<WorkflowDefinition[]> {
    return this.agentsService.findAllWorkflows();
  }

  @Query(() => WorkflowDefinition, { name: 'workflow' })
  findOneWorkflow(@Args('id', { type: () => ID }) id: string): Promise<WorkflowDefinition> {
    return this.agentsService.findOneWorkflow(id);
  }

  @Mutation(() => WorkflowDefinition)
  createWorkflow(@Args('createWorkflowInput') createWorkflowDto: CreateWorkflowDto): Promise<WorkflowDefinition> {
    return this.agentsService.createWorkflow(createWorkflowDto);
  }

  @Mutation(() => WorkflowDefinition)
  updateWorkflow(
    @Args('id', { type: () => ID }) id: string,
    @Args('updateWorkflowInput') updateWorkflowDto: UpdateWorkflowDto,
  ): Promise<WorkflowDefinition> {
    return this.agentsService.updateWorkflow(id, updateWorkflowDto);
  }

  @Mutation(() => Boolean)
  removeWorkflow(@Args('id', { type: () => ID }) id: string): Promise<boolean> {
    return this.agentsService.removeWorkflow(id);
  }

  @Query(() => [AgentSession], { name: 'agentSessions' })
  findAllSessions(): Promise<AgentSession[]> {
    return this.agentsService.findAllSessions();
  }

  @Query(() => AgentSession, { name: 'agentSession' })
  findOneSession(@Args('id', { type: () => ID }) id: string): Promise<AgentSession> {
    return this.agentsService.findOneSession(id);
  }

  @Mutation(() => AgentSession)
  createSession(): Promise<AgentSession> {
    return this.agentsService.createSession();
  }

  @Query(() => [WorkflowExecution], { name: 'workflowExecutions' })
  findAllExecutions(): Promise<WorkflowExecution[]> {
    return this.agentsService.findAllExecutions();
  }

  @Query(() => WorkflowExecution, { name: 'workflowExecution' })
  findOneExecution(@Args('id', { type: () => ID }) id: string): Promise<WorkflowExecution> {
    return this.agentsService.findOneExecution(id);
  }

  @Mutation(() => WorkflowExecution)
  executeWorkflow(@Args('workflowId', { type: () => ID }) workflowId: string): Promise<WorkflowExecution> {
    return this.agentsService.executeWorkflow(workflowId);
  }
}