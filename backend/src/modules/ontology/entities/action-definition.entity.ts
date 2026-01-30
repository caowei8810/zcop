import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { ObjectType, Field, ID, InputType } from '@nestjs/graphql';
import { EntityDefinition } from './entity-definition.entity';

export enum ActionType {
  CREATE = 'CREATE',
  READ = 'READ',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  CUSTOM = 'CUSTOM',
  WORKFLOW = 'WORKFLOW',
  REPORT = 'REPORT',
  APPROVAL = 'APPROVAL',
}

@ObjectType()
@InputType('ActionDefinitionInput')
@Entity()
export class ActionDefinition {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Column()
  name: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  displayName?: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  description?: string;

  @Field(() => ActionType)
  @Column({
    type: 'enum',
    enum: ActionType,
  })
  type: ActionType;

  @Field(() => EntityDefinition, { nullable: true })
  @ManyToOne(() => EntityDefinition, entity => entity.actions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'entityId' })
  entity?: EntityDefinition;

  @Field(() => String)
  @Column({ name: 'entityId' })
  entityId: string;

  @Field({ nullable: true })
  @Column({ type: 'json', nullable: true })
  parameters?: any; // Parameters required for the action

  @Field({ nullable: true })
  @Column({ type: 'json', nullable: true })
  implementation?: any; // Implementation details (for custom actions)

  @Field({ nullable: true })
  @Column({ type: 'text', nullable: true })
  script?: string; // Optional script for custom actions

  @Field(() => Boolean)
  @Column({ default: true })
  isActive: boolean;

  @Field(() => Boolean)
  @Column({ default: false })
  isSystemAction: boolean; // Whether this is a system-generated action

  @Field(() => String)
  @CreateDateColumn()
  createdAt: Date;

  @Field(() => String)
  @UpdateDateColumn()
  updatedAt: Date;
}