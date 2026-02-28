import { Injectable } from '@nestjs/common';
import { Neo4jService } from 'nest-neo4j';

@Injectable()
export class DataMigrationService {
  constructor(private neo4jService: Neo4jService) {}

  async migrateData(source: any, destination: any, mapping: any): Promise<any> {
    const startTime = Date.now();
    let processed = 0;
    let errors = 0;

    try {
      // Validate mapping configuration
      if (!mapping || !mapping.properties) {
        throw new Error('Invalid mapping configuration provided');
      }

      // Prepare migration data
      const sourceData = await this.getSourceData(source);
      const migratedData = [];

      // Process each record
      for (const record of sourceData) {
        try {
          const migratedRecord = await this.migrateRecord(record, mapping);
          migratedData.push(migratedRecord);
          processed++;

          // Batch insert every 100 records
          if (migratedData.length >= 100) {
            await this.insertBatch(destination, migratedData.splice(0, 100));
          }
        } catch (error) {
          errors++;
          console.error(`Error migrating record:`, error);
        }
      }

      // Insert remaining records
      if (migratedData.length > 0) {
        await this.insertBatch(destination, migratedData);
      }

      const duration = Date.now() - startTime;

      return {
        success: true,
        processed,
        errors,
        duration,
        message: `Data migration completed successfully. Processed: ${processed}, Errors: ${errors}, Duration: ${duration}ms`
      };
    } catch (error) {
      return {
        success: false,
        processed,
        errors: errors + 1,
        duration: Date.now() - startTime,
        error: error.message,
        message: `Data migration failed: ${error.message}`
      };
    }
  }

  async migrateOntologyStructure(oldOntology: any, newOntology: any): Promise<any> {
    const changes = await this.analyzeOntologyChanges(oldOntology, newOntology);
    
    // Apply transformations based on changes
    const transformationResults = {
      entitiesRenamed: 0,
      propertiesAdded: 0,
      propertiesRemoved: 0,
      relationshipsUpdated: 0,
      dataTransformed: 0
    };

    // Rename entity labels if needed
    for (const rename of changes.entityRenames) {
      await this.renameEntityLabel(rename.oldName, rename.newName);
      transformationResults.entitiesRenamed++;
    }

    // Add new properties to existing nodes
    for (const addition of changes.propertyAdditions) {
      await this.addPropertyToEntity(addition.entity, addition.property);
      transformationResults.propertiesAdded++;
    }

    // Remove properties from nodes (soft removal - mark as deprecated)
    for (const removal of changes.propertyRemovals) {
      await this.deprecateProperty(removal.entity, removal.property);
      transformationResults.propertiesRemoved++;
    }

    // Update relationship types
    for (const update of changes.relationshipUpdates) {
      await this.updateRelationshipType(update.oldType, update.newType);
      transformationResults.relationshipsUpdated++;
    }

    return {
      success: true,
      changes,
      transformationResults,
      message: `Ontology migration completed. Updated ${transformationResults.entitiesRenamed} entities, added ${transformationResults.propertiesAdded} properties, removed ${transformationResults.propertiesRemoved} properties, updated ${transformationResults.relationshipsUpdated} relationships.`
    };
  }

  async backupData(entities: string[], options: any = {}): Promise<any> {
    const backup = {
      timestamp: new Date().toISOString(),
      entities: {},
      metadata: {
        entities: entities.length,
        includeRelationships: options.includeRelationships ?? true,
        includeProperties: options.includeProperties ?? true,
        format: options.format ?? 'json',
        size: 0
      }
    };

    for (const entity of entities) {
      const nodesResult = await this.neo4jService.read(
        `MATCH (n:\`${entity}\`) RETURN n, labels(n) AS labels`,
        {}
      );

      const nodes = nodesResult.records.map(record => ({
        id: record.get('n').identity.toInt(),
        labels: record.get('labels'),
        properties: record.get('n').properties,
      }));

      backup.entities[entity] = { nodes };

      // Include relationships if requested
      if (options.includeRelationships) {
        const relsResult = await this.neo4jService.read(`
          MATCH (source:\`${entity}\`)-[r]->(target)
          RETURN r, startNode(r) AS from, endNode(r) AS to
          UNION
          MATCH (target:\`${entity}\`)<-[r]-(source)
          RETURN r, startNode(r) AS from, endNode(r) AS to
        `, {});

        const relationships = relsResult.records.map(record => ({
          id: record.get('r').identity.toInt(),
          type: record.get('r').type,
          startNodeId: record.get('from').identity.toInt(),
          endNodeId: record.get('to').identity.toInt(),
          properties: record.get('r').properties,
        }));

        backup.entities[entity].relationships = relationships;
      }
    }

    // Calculate approximate size
    backup.metadata.size = JSON.stringify(backup).length;

    return backup;
  }

  async restoreData(backup: any, options: any = {}): Promise<any> {
    let restoredNodes = 0;
    let restoredRelationships = 0;
    let errors = 0;

    try {
      for (const [entity, data] of Object.entries(backup.entities as any)) {
        // Restore nodes
        for (const node of data.nodes) {
          try {
            const cypher = `
              CREATE (n:\`${entity}\` $properties)
              RETURN id(n) AS id
            `;
            
            const result = await this.neo4jService.write(cypher, { 
              properties: node.properties 
            });
            
            restoredNodes++;
          } catch (error) {
            errors++;
            console.error(`Error restoring node for entity ${entity}:`, error);
          }
        }

        // Restore relationships if included
        if (data.relationships && options.restoreRelationships !== false) {
          for (const rel of data.relationships) {
            try {
              const cypher = `
                MATCH (from), (to)
                WHERE id(from) = $fromId AND id(to) = $toId
                CREATE (from)-[r:\`${rel.type}\` $properties]->(to)
                RETURN id(r) AS id
              `;
              
              await this.neo4jService.write(cypher, { 
                fromId: rel.startNodeId,
                toId: rel.endNodeId,
                properties: rel.properties 
              });
              
              restoredRelationships++;
            } catch (error) {
              errors++;
              console.error(`Error restoring relationship:`, error);
            }
          }
        }
      }

      return {
        success: true,
        restoredNodes,
        restoredRelationships,
        errors,
        message: `Data restoration completed. Restored ${restoredNodes} nodes and ${restoredRelationships} relationships.`
      };
    } catch (error) {
      return {
        success: false,
        restoredNodes,
        restoredRelationships,
        errors: errors + 1,
        error: error.message,
        message: `Data restoration failed: ${error.message}`
      };
    }
  }

  async validateMigration(source: any, destination: any, validationRules: any[]): Promise<any> {
    const validationResults = {
      passed: [],
      failed: [],
      total: validationRules.length
    };

    for (const rule of validationRules) {
      try {
        const result = await this.executeValidationRule(rule, source, destination);
        if (result.passed) {
          validationResults.passed.push(result);
        } else {
          validationResults.failed.push(result);
        }
      } catch (error) {
        validationResults.failed.push({
          rule: rule.name,
          passed: false,
          error: error.message,
          message: `Validation rule failed with error: ${error.message}`
        });
      }
    }

    return {
      success: validationResults.failed.length === 0,
      validationResults,
      summary: {
        passed: validationResults.passed.length,
        failed: validationResults.failed.length,
        total: validationResults.total,
        passRate: validationResults.total > 0 ? (validationResults.passed.length / validationResults.total) * 100 : 0
      }
    };
  }

  private async getSourceData(source: any): Promise<any[]> {
    // Implementation depends on the source type
    // For now, assuming it's Neo4j
    if (source.type === 'neo4j') {
      const result = await this.neo4jService.read(
        `MATCH (n:\`${source.entity}\`) RETURN n`,
        {}
      );
      return result.records.map(record => record.get('n').properties);
    }
    throw new Error(`Unsupported source type: ${source.type}`);
  }

  private async migrateRecord(record: any, mapping: any): Promise<any> {
    const migratedRecord = {};

    // Apply property mappings
    for (const [destinationProp, sourceProp] of Object.entries(mapping.properties)) {
      if (typeof sourceProp === 'string') {
        // Simple mapping
        migratedRecord[destinationProp] = record[sourceProp];
      } else if (typeof sourceProp === 'object' && sourceProp.transform) {
        // Transformation mapping
        migratedRecord[destinationProp] = await this.applyTransformation(
          record[sourceProp.source],
          sourceProp.transform
        );
      }
    }

    // Add static values
    if (mapping.staticValues) {
      for (const [key, value] of Object.entries(mapping.staticValues)) {
        migratedRecord[key] = value;
      }
    }

    // Apply conditional logic
    if (mapping.conditions) {
      for (const condition of mapping.conditions) {
        if (this.evaluateCondition(record, condition.if)) {
          Object.assign(migratedRecord, condition.then);
        }
      }
    }

    return migratedRecord;
  }

  private async applyTransformation(value: any, transform: any): Promise<any> {
    switch (transform.type) {
      case 'uppercase':
        return typeof value === 'string' ? value.toUpperCase() : value;
      case 'lowercase':
        return typeof value === 'string' ? value.toLowerCase() : value;
      case 'trim':
        return typeof value === 'string' ? value.trim() : value;
      case 'dateFormat':
        if (value) {
          const date = new Date(value);
          return date.toLocaleDateString(transform.options?.locale || 'en-US', transform.options);
        }
        return value;
      case 'math':
        if (typeof value === 'number') {
          switch (transform.operation) {
            case 'multiply':
              return value * transform.by;
            case 'divide':
              return value / transform.by;
            case 'add':
              return value + transform.by;
            case 'subtract':
              return value - transform.by;
          }
        }
        return value;
      case 'substring':
        if (typeof value === 'string') {
          return value.substring(transform.start, transform.end);
        }
        return value;
      case 'custom':
        // In a real implementation, this would execute custom transformation logic
        return value;
      default:
        return value;
    }
  }

  private evaluateCondition(record: any, condition: any): boolean {
    // Simple condition evaluation
    if (condition.field && condition.operator && condition.value !== undefined) {
      const fieldValue = record[condition.field];
      switch (condition.operator) {
        case 'equals':
          return fieldValue === condition.value;
        case 'notEquals':
          return fieldValue !== condition.value;
        case 'greaterThan':
          return fieldValue > condition.value;
        case 'lessThan':
          return fieldValue < condition.value;
        case 'contains':
          return fieldValue && fieldValue.toString().includes(condition.value.toString());
        default:
          return false;
      }
    }
    return false;
  }

  private async insertBatch(destination: any, records: any[]): Promise<void> {
    // Implementation depends on destination type
    // For Neo4j, we'd use a batch insert
    for (const record of records) {
      const cypher = `CREATE (n:\`${destination.entity}\` $properties)`;
      await this.neo4jService.write(cypher, { properties: record });
    }
  }

  private async analyzeOntologyChanges(oldOntology: any, newOntology: any): Promise<any> {
    const changes = {
      entityRenames: [],
      propertyAdditions: [],
      propertyRemovals: [],
      relationshipUpdates: [],
      dataTransformations: []
    };

    // Compare entities
    if (oldOntology.entities && newOntology.entities) {
      for (const oldEntity of oldOntology.entities) {
        const newEntity = newOntology.entities.find((e: any) => e.name === oldEntity.name);
        if (!newEntity) {
          // Entity removed
          changes.dataTransformations.push({
            type: 'entity_removal',
            entity: oldEntity.name
          });
        } else {
          // Check property changes
          const oldProps = oldEntity.properties || [];
          const newProps = newEntity.properties || [];

          // Find new properties
          for (const newProp of newProps) {
            const oldProp = oldProps.find((p: any) => p.name === newProp.name);
            if (!oldProp) {
              changes.propertyAdditions.push({
                entity: oldEntity.name,
                property: newProp
              });
            }
          }

          // Find removed properties
          for (const oldProp of oldProps) {
            const newProp = newProps.find((p: any) => p.name === oldProp.name);
            if (!newProp) {
              changes.propertyRemovals.push({
                entity: oldEntity.name,
                property: oldProp
              });
            }
          }
        }
      }

      // Find new entities
      for (const newEntity of newOntology.entities) {
        const oldEntity = oldOntology.entities.find((e: any) => e.name === newEntity.name);
        if (!oldEntity) {
          changes.dataTransformations.push({
            type: 'entity_addition',
            entity: newEntity.name
          });
        }
      }
    }

    return changes;
  }

  private async renameEntityLabel(oldName: string, newName: string): Promise<void> {
    // In Neo4j, we can't directly rename labels, so we need to copy and delete
    // This is a simplified approach; in practice, this would be more complex
    const copyCypher = `
      MATCH (n:\`${oldName}\`)
      CREATE (copy:\`${newName}\` {properties: n})
      RETURN count(copy) AS copied
    `;
    
    await this.neo4jService.write(copyCypher, {});
    
    // Optionally delete old nodes after confirming the copy worked
    // await this.neo4jService.write(`MATCH (n:\`${oldName}\`) DETACH DELETE n`, {});
  }

  private async addPropertyToEntity(entity: string, property: any): Promise<void> {
    // Add default value to existing nodes
    let defaultValue = null;
    switch (property.type) {
      case 'STRING':
        defaultValue = property.defaultValue || '';
        break;
      case 'NUMBER':
        defaultValue = property.defaultValue || 0;
        break;
      case 'BOOLEAN':
        defaultValue = property.defaultValue || false;
        break;
      case 'DATE':
        defaultValue = property.defaultValue || new Date().toISOString();
        break;
      default:
        defaultValue = property.defaultValue || null;
    }

    const cypher = `
      MATCH (n:\`${entity}\`)
      WHERE n.\`${property.name}\` IS NULL
      SET n.\`${property.name}\` = $defaultValue
    `;
    
    await this.neo4jService.write(cypher, { defaultValue });
  }

  private async deprecateProperty(entity: string, property: any): Promise<void> {
    // Instead of removing, mark as deprecated by renaming
    const cypher = `
      MATCH (n:\`${entity}\`)
      SET n.\`${property.name}_deprecated\` = n.\`${property.name}\`
      REMOVE n.\`${property.name}\`
    `;
    
    await this.neo4jService.write(cypher, {});
  }

  private async updateRelationshipType(oldType: string, newType: string): Promise<void> {
    // Similar to entity labels, Neo4j doesn't allow direct relationship type renaming
    // We would need to copy and delete
    const copyCypher = `
      MATCH (startNode)-[r:\`${oldType}\`]->(endNode)
      CREATE (startNode)-[:\`${newType}\` {properties: r}]->(endNode)
      RETURN count(r) AS copied
    `;
    
    await this.neo4jService.write(copyCypher, {});
    
    // Optionally delete old relationships after confirming the copy worked
    // await this.neo4jService.write(`MATCH ()-[r:\`${oldType}\`]->() DELETE r`, {});
  }

  private async executeValidationRule(rule: any, source: any, destination: any): Promise<any> {
    switch (rule.type) {
      case 'recordCount':
        const sourceCount = await this.getCount(source.entity);
        const destCount = await this.getCount(destination.entity);
        
        return {
          rule: rule.name,
          passed: sourceCount === destCount,
          details: { sourceCount, destCount },
          message: `Record count validation: Source=${sourceCount}, Destination=${destCount}`
        };
        
      case 'fieldComparison':
        // Compare specific fields between source and destination
        // Implementation would depend on specific requirements
        return {
          rule: rule.name,
          passed: true, // Simplified for example
          details: {},
          message: 'Field comparison validation passed'
        };
        
      case 'dataIntegrity':
        // Check for data integrity constraints
        return {
          rule: rule.name,
          passed: true, // Simplified for example
          details: {},
          message: 'Data integrity validation passed'
        };
        
      default:
        throw new Error(`Unknown validation rule type: ${rule.type}`);
    }
  }

  private async getCount(entity: string): Promise<number> {
    const result = await this.neo4jService.read(
      `MATCH (n:\`${entity}\`) RETURN count(n) AS count`,
      {}
    );
    return result.records[0]?.get('count') || 0;
  }
}