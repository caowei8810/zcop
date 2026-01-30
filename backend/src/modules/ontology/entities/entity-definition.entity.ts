import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { ObjectType, Field, ID } from '@nestjs/graphql';
import { PropertyDefinition } from './property-definition.entity';
import { RelationDefinition } from './relation-definition.entity';

@ObjectType()
@Entity()
export class EntityDefinition {
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

  @Field({ nullable: true })
  @Column({ nullable: true })
  icon?: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  color?: string;

  @Field(() => [PropertyDefinition], { nullable: true })
  @OneToMany(() => PropertyDefinition, property => property.entity, {
    cascade: true,
    onDelete: 'CASCADE',
  })
  properties?: PropertyDefinition[];

  @Field(() => [RelationDefinition], { nullable: true })
  @OneToMany(() => RelationDefinition, relation => relation.fromEntity, {
    cascade: true,
    onDelete: 'CASCADE',
  })
  relations?: RelationDefinition[];

  @Field(() => [RelationDefinition], { nullable: true })
  @OneToMany(() => RelationDefinition, relation => relation.toEntity, {
    cascade: true,
    onDelete: 'CASCADE',
  })
  incomingRelations?: RelationDefinition[];

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