import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Connection } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { EntityDefinition } from './entities/entity-definition.entity';
import { PropertyDefinition } from './entities/property-definition.entity';
import { RelationDefinition } from './entities/relation-definition.entity';
import { ActionDefinition } from './entities/action-definition.entity';
import { RuleDefinition } from './entities/rule-definition.entity';
import { Neo4jService } from 'nest-neo4j';

@Injectable()
export class OntologyService {
  constructor(
    @InjectRepository(EntityDefinition)
    private entityRepository: Repository<EntityDefinition>,
    @InjectRepository(PropertyDefinition)
    private propertyRepository: Repository<PropertyDefinition>,
    @InjectRepository(RelationDefinition)
    private relationRepository: Repository<RelationDefinition>,
    @InjectRepository(ActionDefinition)
    private actionRepository: Repository<ActionDefinition>,
    @InjectRepository(RuleDefinition)
    private ruleRepository: Repository<RuleDefinition>,
    private neo4jService: Neo4jService,
    private connection: Connection,
  ) {}

  // Entity operations
  async createEntity(input: Partial<EntityDefinition>): Promise<EntityDefinition> {
    const entity = new EntityDefinition();
    Object.assign(entity, input);
    entity.id = uuidv4();
    
    const savedEntity = await this.entityRepository.save(entity);
    
    // Create corresponding node in Neo4j
    await this.neo4jService.write(
      `CREATE (n:${savedEntity.name} {id: $id, name: $name, createdAt: $createdAt, updatedAt: $updatedAt})`,
      {
        id: savedEntity.id,
        name: savedEntity.name,
        createdAt: savedEntity.createdAt,
        updatedAt: savedEntity.updatedAt,
      }
    );
    
    return savedEntity;
  }

  async getAllEntities(): Promise<EntityDefinition[]> {
    return await this.entityRepository.find({
      where: { isActive: true },
      relations: ['properties', 'relations', 'incomingRelations'],
    });
  }

  async getEntityById(id: string): Promise<EntityDefinition> {
    const entity = await this.entityRepository.findOne({
      where: { id, isActive: true },
      relations: ['properties', 'relations', 'incomingRelations'],
    });
    
    if (!entity) {
      throw new NotFoundException(`Entity with ID ${id} not found`);
    }
    
    return entity;
  }

  async updateEntity(id: string, input: Partial<EntityDefinition>): Promise<EntityDefinition> {
    const entity = await this.getEntityById(id);
    Object.assign(entity, input);
    entity.updatedAt = new Date();
    
    const updatedEntity = await this.entityRepository.save(entity);
    
    // Update corresponding node in Neo4j
    await this.neo4jService.write(
      `MATCH (n) WHERE n.id = $id SET n += $properties`,
      {
        id: updatedEntity.id,
        properties: {
          name: updatedEntity.name,
          displayName: updatedEntity.displayName,
          description: updatedEntity.description,
          updatedAt: updatedEntity.updatedAt,
        },
      }
    );
    
    return updatedEntity;
  }

  async deleteEntity(id: string): Promise<boolean> {
    const entity = await this.getEntityById(id);
    entity.isActive = false;
    entity.updatedAt = new Date();
    
    await this.entityRepository.save(entity);
    
    // Delete corresponding nodes and relationships in Neo4j
    await this.neo4jService.write(
      `MATCH (n) WHERE n.id = $id DETACH DELETE n`,
      { id }
    );
    
    return true;
  }

  // Property operations
  async createProperty(input: Partial<PropertyDefinition>): Promise<PropertyDefinition> {
    const property = new PropertyDefinition();
    Object.assign(property, input);
    property.id = uuidv4();
    
    return await this.propertyRepository.save(property);
  }

  async getPropertyById(id: string): Promise<PropertyDefinition> {
    const property = await this.propertyRepository.findOne({
      where: { id, isActive: true },
      relations: ['entity'],
    });
    
    if (!property) {
      throw new NotFoundException(`Property with ID ${id} not found`);
    }
    
    return property;
  }

  async updateProperty(id: string, input: Partial<PropertyDefinition>): Promise<PropertyDefinition> {
    const property = await this.getPropertyById(id);
    Object.assign(property, input);
    property.updatedAt = new Date();
    
    return await this.propertyRepository.save(property);
  }

  async deleteProperty(id: string): Promise<boolean> {
    const property = await this.getPropertyById(id);
    property.isActive = false;
    property.updatedAt = new Date();
    
    await this.propertyRepository.save(property);
    return true;
  }

  // Relation operations
  async createRelation(input: Partial<RelationDefinition>): Promise<RelationDefinition> {
    const relation = new RelationDefinition();
    Object.assign(relation, input);
    relation.id = uuidv4();
    
    const savedRelation = await this.relationRepository.save(relation);
    
    // Create relationship in Neo4j
    await this.neo4jService.write(
      `MATCH (from {id: $fromId}), (to {id: $toId}) CREATE (from)-[:${savedRelation.name}]->(to)`,
      {
        fromId: savedRelation.fromEntityId,
        toId: savedRelation.toEntityId,
      }
    );
    
    return savedRelation;
  }

  async getRelationById(id: string): Promise<RelationDefinition> {
    const relation = await this.relationRepository.findOne({
      where: { id, isActive: true },
      relations: ['fromEntity', 'toEntity'],
    });
    
    if (!relation) {
      throw new NotFoundException(`Relation with ID ${id} not found`);
    }
    
    return relation;
  }

  async updateRelation(id: string, input: Partial<RelationDefinition>): Promise<RelationDefinition> {
    const relation = await this.getRelationById(id);
    Object.assign(relation, input);
    relation.updatedAt = new Date();
    
    return await this.relationRepository.save(relation);
  }

  async deleteRelation(id: string): Promise<boolean> {
    const relation = await this.getRelationById(id);
    
    // Delete relationship in Neo4j
    await this.neo4jService.write(
      `MATCH (from)-[r {id: $id}]->(to) DELETE r`,
      { id }
    );
    
    await this.relationRepository.remove(relation);
    return true;
  }

  // Action operations
  async createAction(input: Partial<ActionDefinition>): Promise<ActionDefinition> {
    const action = new ActionDefinition();
    Object.assign(action, input);
    action.id = uuidv4();
    
    return await this.actionRepository.save(action);
  }

  async getActionById(id: string): Promise<ActionDefinition> {
    const action = await this.actionRepository.findOne({
      where: { id, isActive: true },
      relations: ['entity'],
    });
    
    if (!action) {
      throw new NotFoundException(`Action with ID ${id} not found`);
    }
    
    return action;
  }

  async deleteAction(id: string): Promise<boolean> {
    const action = await this.getActionById(id);
    action.isActive = false;
    action.updatedAt = new Date();
    
    await this.actionRepository.save(action);
    return true;
  }

  // Rule operations
  async createRule(input: Partial<RuleDefinition>): Promise<RuleDefinition> {
    const rule = new RuleDefinition();
    Object.assign(rule, input);
    rule.id = uuidv4();
    
    return await this.ruleRepository.save(rule);
  }

  async getRuleById(id: string): Promise<RuleDefinition> {
    const rule = await this.ruleRepository.findOne({
      where: { id, isActive: true },
      relations: ['entity'],
    });
    
    if (!rule) {
      throw new NotFoundException(`Rule with ID ${id} not found`);
    }
    
    return rule;
  }

  async deleteRule(id: string): Promise<boolean> {
    const rule = await this.getRuleById(id);
    rule.isActive = false;
    rule.updatedAt = new Date();
    
    await this.ruleRepository.save(rule);
    return true;
  }

  // Knowledge graph operations
  async getKnowledgeGraph(): Promise<any> {
    // Get all entities and their relationships
    const entities = await this.getAllEntities();
    
    // Query Neo4j for the actual knowledge graph data
    const result = await this.neo4jService.read(
      `MATCH (n) OPTIONAL MATCH (n)-[r]->(m) RETURN n, r, m LIMIT 1000`
    );
    
    return {
      entities,
      graph: result.records.map(record => ({
        from: record.get('n'),
        relationship: record.get('r'),
        to: record.get('m'),
      })),
    };
  }
}