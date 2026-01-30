import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { ObjectType, Field, ID, InputType } from '@nestjs/graphql';
import { EntityDefinition } from './entity-definition.entity';

export enum PropertyType {
  STRING = 'STRING',
  NUMBER = 'NUMBER',
  BOOLEAN = 'BOOLEAN',
  DATE = 'DATE',
  DATETIME = 'DATETIME',
  ENUM = 'ENUM',
  REFERENCE = 'REFERENCE',
  ARRAY = 'ARRAY',
  OBJECT = 'OBJECT',
}

@ObjectType()
@InputType('PropertyDefinitionInput')
@Entity()
export class PropertyDefinition {
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

  @Field(() => PropertyType)
  @Column({
    type: 'enum',
    enum: PropertyType,
  })
  type: PropertyType;

  @Field(() => Boolean)
  @Column({ default: false })
  required: boolean;

  @Field(() => Boolean)
  @Column({ default: false })
  unique: boolean;

  @Field(() => Boolean)
  @Column({ default: false })
  indexed: boolean;

  @Field({ nullable: true })
  @Column({ type: 'json', nullable: true })
  validationRules?: any;

  @Field({ nullable: true })
  @Column({ type: 'json', nullable: true })
  defaultValue?: any;

  @Field(() => [String], { nullable: true })
  @Column('text', { array: true, nullable: true })
  enumValues?: string[];

  @Field(() => EntityDefinition, { nullable: true })
  @ManyToOne(() => EntityDefinition, entity => entity.properties, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'entityId' })
  entity?: EntityDefinition;

  @Field(() => String)
  @Column({ name: 'entityId' })
  entityId: string;

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