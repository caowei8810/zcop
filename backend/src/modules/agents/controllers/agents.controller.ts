import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { AgentsService } from '../services/agents.service';
import { WorkflowDefinition } from '../entities/workflow-definition.entity';
import { AgentSession } from '../entities/agent-session.entity';
import { WorkflowExecution } from '../entities/workflow-execution.entity';
import { JwtAuthGuard } from '../../modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../modules/auth/decorators/roles.decorator';

@Controller('api/agents')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Get('workflows')
  @Roles('admin', 'user')
  findAllWorkflows(): Promise<WorkflowDefinition[]> {
    return this.agentsService.findAllWorkflows();
  }

  @Get('workflows/:id')
  @Roles('admin', 'user')
  findOneWorkflow(@Param('id') id: string): Promise<WorkflowDefinition> {
    return this.agentsService.findOneWorkflow(id);
  }

  @Post('workflows')
  @Roles('admin')
  createWorkflow(@Body() createWorkflowDto: any): Promise<WorkflowDefinition> {
    return this.agentsService.createWorkflow(createWorkflowDto);
  }

  @Patch('workflows/:id')
  @Roles('admin')
  updateWorkflow(@Param('id') id: string, @Body() updateWorkflowDto: any): Promise<WorkflowDefinition> {
    return this.agentsService.updateWorkflow(id, updateWorkflowDto);
  }

  @Delete('workflows/:id')
  @Roles('admin')
  removeWorkflow(@Param('id') id: string): Promise<boolean> {
    return this.agentsService.removeWorkflow(id);
  }

  @Get('sessions')
  @Roles('admin', 'user')
  findAllSessions(): Promise<AgentSession[]> {
    return this.agentsService.findAllSessions();
  }

  @Get('sessions/:id')
  @Roles('admin', 'user')
  findOneSession(@Param('id') id: string): Promise<AgentSession> {
    return this.agentsService.findOneSession(id);
  }

  @Post('sessions')
  @Roles('admin', 'user')
  createSession(): Promise<AgentSession> {
    return this.agentsService.createSession();
  }

  @Get('executions')
  @Roles('admin', 'user')
  findAllExecutions(): Promise<WorkflowExecution[]> {
    return this.agentsService.findAllExecutions();
  }

  @Get('executions/:id')
  @Roles('admin', 'user')
  findOneExecution(@Param('id') id: string): Promise<WorkflowExecution> {
    return this.agentsService.findOneExecution(id);
  }

  @Post('executions')
  @Roles('admin', 'user')
  executeWorkflow(@Body() executionRequest: { workflowId: string }): Promise<WorkflowExecution> {
    return this.agentsService.executeWorkflow(executionRequest.workflowId);
  }

  @Post('workflows/:id/execute')
  @Roles('admin', 'user')
  executeWorkflowById(@Param('id') id: string): Promise<WorkflowExecution> {
    return this.agentsService.executeWorkflow(id);
  }
}