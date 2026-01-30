import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { OntologyService } from '../services/ontology.service';
import { EntityDefinition } from '../entities/entity-definition.entity';
import { PropertyDefinition } from '../entities/property-definition.entity';
import { RelationDefinition } from '../entities/relation-definition.entity';
import { ActionDefinition } from '../entities/action-definition.entity';
import { RuleDefinition } from '../entities/rule-definition.entity';

@Resolver(() => EntityDefinition)
export class OntologyResolver {
  constructor(private readonly ontologyService: OntologyService) {}

  // Entity resolvers
  @Query(() => [EntityDefinition])
  async entities(): Promise<EntityDefinition[]> {
    return this.ontologyService.getAllEntities();
  }

  @Query(() => EntityDefinition)
  async entity(@Args('id', { type: () => ID }) id: string): Promise<EntityDefinition> {
    return this.ontologyService.getEntityById(id);
  }

  @Mutation(() => EntityDefinition)
  async createEntity(
    @Args('input') input: Partial<EntityDefinition>
  ): Promise<EntityDefinition> {
    return this.ontologyService.createEntity(input);
  }

  @Mutation(() => EntityDefinition)
  async updateEntity(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: Partial<EntityDefinition>
  ): Promise<EntityDefinition> {
    return this.ontologyService.updateEntity(id, input);
  }

  @Mutation(() => Boolean)
  async deleteEntity(@Args('id', { type: () => ID }) id: string): Promise<boolean> {
    return this.ontologyService.deleteEntity(id);
  }

  // Property resolvers
  @Query(() => PropertyDefinition)
  async property(@Args('id', { type: () => ID }) id: string): Promise<PropertyDefinition> {
    return this.ontologyService.getPropertyById(id);
  }

  @Mutation(() => PropertyDefinition)
  async createProperty(
    @Args('input') input: Partial<PropertyDefinition>
  ): Promise<PropertyDefinition> {
    return this.ontologyService.createProperty(input);
  }

  @Mutation(() => PropertyDefinition)
  async updateProperty(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: Partial<PropertyDefinition>
  ): Promise<PropertyDefinition> {
    return this.ontologyService.updateProperty(id, input);
  }

  @Mutation(() => Boolean)
  async deleteProperty(@Args('id', { type: () => ID }) id: string): Promise<boolean> {
    return this.ontologyService.deleteProperty(id);
  }

  // Relation resolvers
  @Query(() => RelationDefinition)
  async relation(@Args('id', { type: () => ID }) id: string): Promise<RelationDefinition> {
    return this.ontologyService.getRelationById(id);
  }

  @Mutation(() => RelationDefinition)
  async createRelation(
    @Args('input') input: Partial<RelationDefinition>
  ): Promise<RelationDefinition> {
    return this.ontologyService.createRelation(input);
  }

  @Mutation(() => RelationDefinition)
  async updateRelation(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: Partial<RelationDefinition>
  ): Promise<RelationDefinition> {
    return this.ontologyService.updateRelation(id, input);
  }

  @Mutation(() => Boolean)
  async deleteRelation(@Args('id', { type: () => ID }) id: string): Promise<boolean> {
    return this.ontologyService.deleteRelation(id);
  }

  // Action resolvers
  @Query(() => ActionDefinition)
  async action(@Args('id', { type: () => ID }) id: string): Promise<ActionDefinition> {
    return this.ontologyService.getActionById(id);
  }

  @Mutation(() => ActionDefinition)
  async createAction(
    @Args('input') input: Partial<ActionDefinition>
  ): Promise<ActionDefinition> {
    return this.ontologyService.createAction(input);
  }

  @Mutation(() => Boolean)
  async deleteAction(@Args('id', { type: () => ID }) id: string): Promise<boolean> {
    return this.ontologyService.deleteAction(id);
  }

  // Rule resolvers
  @Query(() => RuleDefinition)
  async rule(@Args('id', { type: () => ID }) id: string): Promise<RuleDefinition> {
    return this.ontologyService.getRuleById(id);
  }

  @Mutation(() => RuleDefinition)
  async createRule(
    @Args('input') input: Partial<RuleDefinition>
  ): Promise<RuleDefinition> {
    return this.ontologyService.createRule(input);
  }

  @Mutation(() => Boolean)
  async deleteRule(@Args('id', { type: () => ID }) id: string): Promise<boolean> {
    return this.ontologyService.deleteRule(id);
  }

  // Knowledge graph resolver
  @Query(() => [EntityDefinition])
  async knowledgeGraph() {
    const kg = await this.ontologyService.getKnowledgeGraph();
    return kg.entities;
  }
}