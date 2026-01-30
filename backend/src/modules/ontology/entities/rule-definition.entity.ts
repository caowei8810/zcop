import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { ObjectType, Field, ID, InputType } from '@nestjs/graphql';
import { EntityDefinition } from './entity-definition.entity';

export enum RuleType {
  VALIDATION = 'VALIDATION',
  COMPUTATION = 'COMPUTATION',
  TRIGGER = 'TRIGGER',
  CONSTRAINT = 'CONSTRAINT',
  BUSINESS_LOGIC = 'BUSINESS_LOGIC',
}

export enum RuleScope {
  ENTITY = 'ENTITY',
  PROPERTY = 'PROPERTY',
  RELATION = 'RELATION',
  GLOBAL = 'GLOBAL',
}

@ObjectType()
@InputType('RuleDefinitionInput')
@Entity()
export class RuleDefinition {
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

  @Field(() => RuleType)
  @Column({
    type: 'enum',
    enum: RuleType,
  })
  type: RuleType;

  @Field(() => RuleScope)
  @Column({
    type: 'enum',
    enum: RuleScope,
  })
  scope: RuleScope;

  @Field(() => EntityDefinition, { nullable: true })
  @ManyToOne(() => EntityDefinition, entity => entity.rules, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'entityId' })
  entity?: EntityDefinition;

  @Field(() => String)
  @Column({ name: 'entityId' })
  entityId: string;

  @Field({ nullable: true })
  @Column({ type: 'json', nullable: true })
  condition?: any; // Rule condition (serialized as JSON)

  @Field({ nullable: true })
  @Column({ type: 'json', nullable: true })
  action?: any; // Rule action (serialized as JSON)

  @Field({ nullable: true })
  @Column({ type: 'text', nullable: true })
  expression?: string; // Rule expression (e.g., in JavaScript or a DSL)

  @Field(() => Boolean)
  @Column({ default: true })
  isActive: boolean;

  @Field(() => Boolean)
  @Column({ default: false })
  isSystemRule: boolean; // Whether this is a system-generated rule

  @Field(() => String)
  @CreateDateColumn()
  createdAt: Date;

  @Field(() => String)
  @UpdateDateColumn()
  updatedAt: Date;
}