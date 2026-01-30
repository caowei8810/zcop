import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType()
@Entity()
export class AgentSession {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Column()
  sessionId: string;

  @Field()
  @Column()
  userId: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  currentWorkflowId?: string;

  @Field(() => String)
  @Column({ type: 'json' })
  context: any; // Current session context

  @Field(() => String)
  @Column({ type: 'json' })
  history: any[]; // Conversation history

  @Field(() => Boolean)
  @Column({ default: true })
  isActive: boolean;

  @Field(() => String)
  @CreateDateColumn()
  createdAt: Date;

  @Field(() => String)
  @UpdateDateColumn()
  updatedAt: Date;
}