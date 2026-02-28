import { Injectable } from '@nestjs/common';
import { Neo4jService } from 'nest-neo4j';

@Injectable()
export class SchemaService {
  constructor(private neo4jService: Neo4jService) {}

  async getGraphSchema(): Promise<any> {
    // Get all node labels in the graph
    const labelsResult = await this.neo4jService.read(
      'CALL db.labels()',
      {}
    );
    
    // Get all relationship types
    const relTypesResult = await this.neo4jService.read(
      'CALL db.relationshipTypes()',
      {}
    );
    
    // Get property keys for each label
    const labels = labelsResult.records.map(record => record.get('label'));
    const relTypes = relTypesResult.records.map(record => record.get('relationshipType'));
    
    const schema: any = {
      nodes: {},
      relationships: {},
    };
    
    // Get property keys for each label
    for (const label of labels) {
      const propsResult = await this.neo4jService.read(`
        MATCH (n:\`${label}\`)
        WITH keys(n) AS props
        UNWIND props AS prop
        RETURN prop, count(n) AS count
      `, {});
      
      schema.nodes[label] = {
        properties: propsResult.records.map(record => ({
          name: record.get('prop'),
          usedBy: record.get('count'),
        })),
        count: await this.getNodeCountByLabel(label),
      };
    }
    
    // Get relationship properties
    for (const relType of relTypes) {
      const propsResult = await this.neo4jService.read(`
        MATCH ()-[r:\`${relType}\`]-()
        WITH keys(r) AS props
        UNWIND props AS prop
        RETURN prop, count(r) AS count
      `, {});
      
      schema.relationships[relType] = {
        properties: propsResult.records.map(record => ({
          name: record.get('prop'),
          usedBy: record.get('count'),
        })),
        count: await this.getRelCountByType(relType),
      };
    }
    
    return schema;
  }

  async validateNodeStructure(label: string, properties: Record<string, any>): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];
    
    // Check if label exists
    const labelsResult = await this.neo4jService.read('CALL db.labels()', {});
    const existingLabels = labelsResult.records.map(record => record.get('label'));
    
    if (!existingLabels.includes(label)) {
      errors.push(`Label '${label}' does not exist in the graph`);
    }
    
    // Validate property types if possible
    // In a real implementation, we would maintain schema definitions
    // For now, just check for basic constraints
    
    // Return validation result
    return {
      valid: errors.length === 0,
      errors,
    };
  }

  async validateRelationshipStructure(
    fromLabel: string, 
    relType: string, 
    toLabel: string
  ): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];
    
    // Check if relationship type exists
    const relTypesResult = await this.neo4jService.read('CALL db.relationshipTypes()', {});
    const existingRelTypes = relTypesResult.records.map(record => record.get('relationshipType'));
    
    if (!existingRelTypes.includes(relType)) {
      errors.push(`Relationship type '${relType}' does not exist in the graph`);
    }
    
    return {
      valid: errors.length === 0,
      errors,
    };
  }

  async suggestOptimalSchema(ontologyDefinition: any): Promise<any> {
    // Analyze the ontology definition and suggest an optimal Neo4j schema
    // This would involve analyzing entity relationships and suggesting
    // the best way to represent them in Neo4j
    
    const suggestions = {
      nodeLabels: [],
      relationshipTypes: [],
      indexes: [],
      constraints: [],
    };
    
    // Process entities
    if (ontologyDefinition.entities) {
      for (const entity of ontologyDefinition.entities) {
        suggestions.nodeLabels.push({
          name: entity.name,
          recommendedProperties: entity.properties?.map(p => p.name) || [],
        });
        
        // Suggest indexes for unique properties
        if (entity.properties) {
          for (const prop of entity.properties) {
            if (prop.unique) {
              suggestions.indexes.push({
                type: 'node_property',
                label: entity.name,
                property: prop.name,
                description: `Index for unique property ${prop.name} on ${entity.name}`,
              });
            }
          }
        }
      }
    }
    
    // Process relationships
    if (ontologyDefinition.relationships) {
      for (const rel of ontologyDefinition.relationships) {
        suggestions.relationshipTypes.push({
          name: rel.name,
          fromLabel: rel.fromEntity,
          toLabel: rel.toEntity,
          description: rel.description,
        });
      }
    }
    
    return suggestions;
  }

  async getIndexes(): Promise<any[]> {
    // Get existing indexes in the database
    try {
      const result = await this.neo4jService.read('SHOW INDEXES', {});
      return result.records.map(record => ({
        name: record.get('name'),
        type: record.get('type'),
        entityType: record.get('entityType'),
        labelsOrTypes: record.get('labelsOrTypes'),
        properties: record.get('properties'),
        state: record.get('state'),
        populationProgress: record.get('populationProgress'),
      }));
    } catch (error) {
      // SHOW INDEXES might not be available in all Neo4j versions
      return [];
    }
  }

  async getConstraints(): Promise<any[]> {
    // Get existing constraints in the database
    try {
      const result = await this.neo4jService.read('SHOW CONSTRAINTS', {});
      return result.records.map(record => ({
        name: record.get('name'),
        type: record.get('type'),
        entityType: record.get('entityType'),
        labelsOrTypes: record.get('labelsOrTypes'),
        properties: record.get('properties'),
        ownedIndex: record.get('ownedIndex'),
      }));
    } catch (error) {
      // SHOW CONSTRAINTS might not be available in all Neo4j versions
      return [];
    }
  }

  async createRecommendedIndexes(ontologyDefinition: any): Promise<any[]> {
    const createdIndexes = [];
    
    if (ontologyDefinition.entities) {
      for (const entity of ontologyDefinition.entities) {
        if (entity.properties) {
          for (const prop of entity.properties) {
            if (prop.unique || prop.indexed) {
              try {
                const indexName = `index_${entity.name}_${prop.name}`;
                await this.neo4jService.write(
                  `CREATE INDEX ${indexName} FOR (n:\`${entity.name}\`) ON (n.\`${prop.name}\`)`,
                  {}
                );
                
                createdIndexes.push({
                  name: indexName,
                  entity: entity.name,
                  property: prop.name,
                  type: prop.unique ? 'unique' : 'index',
                });
              } catch (error) {
                // Index might already exist
                console.warn(`Could not create index for ${entity.name}.${prop.name}:`, error.message);
              }
            }
          }
        }
      }
    }
    
    return createdIndexes;
  }

  private async getNodeCountByLabel(label: string): Promise<number> {
    const result = await this.neo4jService.read(
      `MATCH (n:\`${label}\`) RETURN count(n) AS count`,
      {}
    );
    return result.records[0]?.get('count') || 0;
  }

  private async getRelCountByType(type: string): Promise<number> {
    const result = await this.neo4jService.read(
      `MATCH ()-[r:\`${type}\`]-() RETURN count(r) AS count`,
      {}
    );
    return result.records[0]?.get('count') || 0;
  }
}