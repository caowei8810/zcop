import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { ObjectType, Field, ID, InputType } from '@nestjs/graphql';
import { EntityDefinition } from './entity-definition.entity';

export enum RelationType {
  ONE_TO_ONE = 'ONE_TO_ONE',
  ONE_TO_MANY = 'ONE_TO_MANY',
  MANY_TO_ONE = 'MANY_TO_ONE',
  MANY_TO_MANY = 'MANY_TO_MANY',
}

export enum Cardinality {
  ONE = 'ONE',
  ZERO_OR_ONE = 'ZERO_OR_ONE',
  MANY = 'MANY',
  ZERO_OR_MANY = 'ZERO_OR_MANY',
}

@ObjectType()
@InputType('RelationDefinitionInput')
@Entity()
export class RelationDefinition {
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

  @Field(() => RelationType)
  @Column({
    type: 'enum',
    enum: RelationType,
  })
  relationType: RelationType;

  @Field(() => Cardinality)
  @Column({
    type: 'enum',
    enum: Cardinality,
  })
  fromCardinality: Cardinality;

  @Field(() => Cardinality)
  @Column({
    type: 'enum',
    enum: Cardinality,
  })
  toCardinality: Cardinality;

  @Field(() => EntityDefinition)
  @ManyToOne(() => EntityDefinition, entity => entity.relations, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'fromEntityId' })
  fromEntity?: EntityDefinition;

  @Field(() => String)
  @Column({ name: 'fromEntityId' })
  fromEntityId: string;

  @Field(() => EntityDefinition)
  @ManyToOne(() => EntityDefinition, entity => entity.incomingRelations, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'toEntityId' })
  toEntity?: EntityDefinition;

  @Field(() => String)
  @Column({ name: 'toEntityId' })
  toEntityId: string;

  @Field({ nullable: true })
  @Column({ type: 'json', nullable: true })
  properties?: any; // Additional properties for the relation itself

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