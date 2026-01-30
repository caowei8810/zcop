import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentsResolver } from './resolvers/agents.resolver';
import { AgentsService } from './services/agents.service';
import { WorkflowDefinition } from './entities/workflow-definition.entity';
import { AgentSession } from './entities/agent-session.entity';
import { WorkflowExecution } from './entities/workflow-execution.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WorkflowDefinition,
      AgentSession,
      WorkflowExecution,
    ]),
  ],
  providers: [
    AgentsResolver,
    AgentsService,
  ],
  exports: [AgentsService],
})
export class AgentsModule {}