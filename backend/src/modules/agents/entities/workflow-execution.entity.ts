import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { ObjectType, Field, ID } from '@nestjs/graphql';

export enum ExecutionStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

@ObjectType()
@Entity()
export class WorkflowExecution {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Column()
  workflowId: string;

  @Field()
  @Column()
  sessionId: string;

  @Field(() => ExecutionStatus)
  @Column({
    type: 'enum',
    enum: ExecutionStatus,
  })
  status: ExecutionStatus;

  @Field(() => String)
  @Column({ type: 'json' })
  inputs: any; // Execution inputs

  @Field(() => String)
  @Column({ type: 'json' })
  outputs: any; // Execution outputs

  @Field(() => String)
  @Column({ type: 'json' })
  executionTrace: any; // Step-by-step execution trace

  @Field(() => String)
  @Column({ type: 'json', nullable: true })
  errorDetails?: any; // Error details if failed

  @Field(() => String)
  @CreateDateColumn()
  createdAt: Date;

  @Field(() => String)
  @UpdateDateColumn()
  updatedAt: Date;
}