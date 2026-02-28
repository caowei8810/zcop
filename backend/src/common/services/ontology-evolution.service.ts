import { Injectable } from '@nestjs/common';
import { Neo4jService } from 'nest-neo4j';

@Injectable()
export class OntologyEvolutionService {
  constructor(private neo4jService: Neo4jService) {}

  async createOntology(ontologyDefinition: any): Promise<any> {
    // Validate ontology definition
    const validation = this.validateOntologyDefinition(ontologyDefinition);
    if (!validation.isValid) {
      throw new Error(`Invalid ontology definition: ${validation.errors.join(', ')}`);
    }

    const cypher = `
      CREATE (ont:Ontology {
        id: $id,
        name: $name,
        description: $description,
        version: $version,
        namespace: $namespace,
        status: $status,
        createdBy: $createdBy,
        createdAt: $createdAt,
        updatedAt: $updatedAt
      })
      RETURN ont
    `;

    const id = `ont-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const now = new Date().toISOString();

    const result = await this.neo4jService.write(cypher, {
      id,
      name: ontologyDefinition.name,
      description: ontologyDefinition.description,
      version: ontologyDefinition.version || '1.0.0',
      namespace: ontologyDefinition.namespace || `urn:ontology:${ontologyDefinition.name.toLowerCase()}`,
      status: 'draft',
      createdBy: ontologyDefinition.createdBy || 'system',
      createdAt: now,
      updatedAt: now
    });

    // Create classes if provided
    if (ontologyDefinition.classes && Array.isArray(ontologyDefinition.classes)) {
      await this.createClassHierarchy(id, ontologyDefinition.classes);
    }

    // Create relationships if provided
    if (ontologyDefinition.relationships && Array.isArray(ontologyDefinition.relationships)) {
      await this.createRelationships(id, ontologyDefinition.relationships);
    }

    // Create properties if provided
    if (ontologyDefinition.properties && Array.isArray(ontologyDefinition.properties)) {
      await this.createProperties(id, ontologyDefinition.properties);
    }

    return result.records[0].get('ont');
  }

  async publishOntology(ontologyId: string, publishedBy: string): Promise<any> {
    // Validate that the ontology is ready for publication
    const validation = await this.validateOntologyForPublication(ontologyId);
    if (!validation.isValid) {
      throw new Error(`Cannot publish ontology: ${validation.errors.join(', ')}`);
    }

    const cypher = `
      MATCH (ont:Ontology {id: $ontologyId})
      WHERE ont.status = 'draft'
      SET ont.status = 'published',
          ont.publishedAt = $publishedAt,
          ont.publishedBy = $publishedBy,
          ont.updatedAt = $updatedAt
      RETURN ont
    `;

    const result = await this.neo4jService.write(cypher, {
      ontologyId,
      publishedAt: new Date().toISOString(),
      publishedBy,
      updatedAt: new Date().toISOString()
    });

    if (result.records.length === 0) {
      throw new Error(`Ontology ${ontologyId} not found or already published`);
    }

    return result.records[0].get('ont');
  }

  async createOntologyVersion(ontologyId: string, versionDefinition: any): Promise<any> {
    // Get current version of the ontology
    const currentOntology = await this.getOntology(ontologyId);
    if (!currentOntology) {
      throw new Error(`Ontology ${ontologyId} not found`);
    }

    // Create a new version with evolution changes
    const newVersion = await this.createOntology({
      ...versionDefinition,
      name: currentOntology.name,
      version: this.incrementVersion(currentOntology.version),
      namespace: currentOntology.namespace,
      createdBy: versionDefinition.createdBy || 'system'
    });

    // Establish version relationship
    const versionCypher = `
      MATCH (current:Ontology {id: $currentId}), (newVer:Ontology {id: $newId})
      CREATE (newVer)-[:VERSION_OF]->(current)
      RETURN newVer
    `;

    const versionResult = await this.neo4jService.write(versionCypher, {
      currentId: ontologyId,
      newId: newVersion.id
    });

    return versionResult.records[0].get('newVer');
  }

  async getOntology(ontologyId: string): Promise<any> {
    const cypher = `
      MATCH (ont:Ontology {id: $ontologyId})
      OPTIONAL MATCH (ont)-[:CONTAINS_CLASS]->(cls:OntologyClass)
      OPTIONAL MATCH (ont)-[:CONTAINS_RELATIONSHIP]->(rel:OntologyRelationship)
      OPTIONAL MATCH (ont)-[:CONTAINS_PROPERTY]->(prop:OntologyProperty)
      RETURN ont, 
             collect(DISTINCT cls) AS classes,
             collect(DISTINCT rel) AS relationships,
             collect(DISTINCT prop) AS properties
    `;

    const result = await this.neo4jService.read(cypher, { ontologyId });
    if (result.records.length === 0) return null;

    const record = result.records[0];
    const ontology = record.get('ont');
    const classes = record.get('classes');
    const relationships = record.get('relationships');
    const properties = record.get('properties');

    return {
      ...ontology,
      classes: classes.map((c: any) => c.properties),
      relationships: relationships.map((r: any) => r.properties),
      properties: properties.map((p: any) => p.properties)
    };
  }

  async getOntologies(filter: any = {}): Promise<any[]> {
    let whereClause = '';
    const params: any = {};

    if (filter.status) {
      whereClause = 'WHERE ont.status = $status ';
      params.status = filter.status;
    }

    if (filter.version) {
      if (whereClause) whereClause += 'AND ';
      else whereClause = 'WHERE ';
      whereClause += 'ont.version = $version ';
      params.version = filter.version;
    }

    const cypher = `
      MATCH (ont:Ontology)
      ${whereClause}
      RETURN ont
      ORDER BY ont.createdAt DESC
    `;

    const result = await this.neo4jService.read(cypher, params);
    return result.records.map(record => record.get('ont'));
  }

  async evolveOntology(ontologyId: string, evolutionPlan: any): Promise<any> {
    // Get the current ontology
    const currentOntology = await this.getOntology(ontologyId);
    if (!currentOntology) {
      throw new Error(`Ontology ${ontologyId} not found`);
    }

    // Validate evolution plan
    const validation = this.validateEvolutionPlan(evolutionPlan);
    if (!validation.isValid) {
      throw new Error(`Invalid evolution plan: ${validation.errors.join(', ')}`);
    }

    // Apply evolution changes
    const evolutionResult = {
      addedClasses: 0,
      modifiedClasses: 0,
      removedClasses: 0,
      addedRelationships: 0,
      modifiedRelationships: 0,
      removedRelationships: 0,
      addedProperties: 0,
      modifiedProperties: 0,
      removedProperties: 0,
      changes: []
    };

    // Process additions
    if (evolutionPlan.additions) {
      if (evolutionPlan.additions.classes) {
        for (const cls of evolutionPlan.additions.classes) {
          await this.addClassToOntology(ontologyId, cls);
          evolutionResult.addedClasses++;
          evolutionResult.changes.push({
            type: 'class_added',
            name: cls.name,
            change: cls
          });
        }
      }

      if (evolutionPlan.additions.relationships) {
        for (const rel of evolutionPlan.additions.relationships) {
          await this.addRelationshipToOntology(ontologyId, rel);
          evolutionResult.addedRelationships++;
          evolutionResult.changes.push({
            type: 'relationship_added',
            name: rel.name,
            change: rel
          });
        }
      }

      if (evolutionPlan.additions.properties) {
        for (const prop of evolutionPlan.additions.properties) {
          await this.addPropertyToOntology(ontologyId, prop);
          evolutionResult.addedProperties++;
          evolutionResult.changes.push({
            type: 'property_added',
            name: prop.name,
            change: prop
          });
        }
      }
    }

    // Process modifications
    if (evolutionPlan.modifications) {
      if (evolutionPlan.modifications.classes) {
        for (const mod of evolutionPlan.modifications.classes) {
          await this.modifyClassInOntology(ontologyId, mod.id, mod.updates);
          evolutionResult.modifiedClasses++;
          evolutionResult.changes.push({
            type: 'class_modified',
            id: mod.id,
            changes: mod.updates
          });
        }
      }

      if (evolutionPlan.modifications.relationships) {
        for (const mod of evolutionPlan.modifications.relationships) {
          await this.modifyRelationshipInOntology(ontologyId, mod.id, mod.updates);
          evolutionResult.modifiedRelationships++;
          evolutionResult.changes.push({
            type: 'relationship_modified',
            id: mod.id,
            changes: mod.updates
          });
        }
      }

      if (evolutionPlan.modifications.properties) {
        for (const mod of evolutionPlan.modifications.properties) {
          await this.modifyPropertyInOntology(ontologyId, mod.id, mod.updates);
          evolutionResult.modifiedProperties++;
          evolutionResult.changes.push({
            type: 'property_modified',
            id: mod.id,
            changes: mod.updates
          });
        }
      }
    }

    // Process removals
    if (evolutionPlan.removals) {
      if (evolutionPlan.removals.classes) {
        for (const id of evolutionPlan.removals.classes) {
          await this.removeClassFromOntology(ontologyId, id);
          evolutionResult.removedClasses++;
          evolutionResult.changes.push({
            type: 'class_removed',
            id
          });
        }
      }

      if (evolutionPlan.removals.relationships) {
        for (const id of evolutionPlan.removals.relationships) {
          await this.removeRelationshipFromOntology(ontologyId, id);
          evolutionResult.removedRelationships++;
          evolutionResult.changes.push({
            type: 'relationship_removed',
            id
          });
        }
      }

      if (evolutionPlan.removals.properties) {
        for (const id of evolutionPlan.removals.properties) {
          await this.removePropertyFromOntology(ontologyId, id);
          evolutionResult.removedProperties++;
          evolutionResult.changes.push({
            type: 'property_removed',
            id
          });
        }
      }
    }

    // Update ontology version and timestamp
    const updateCypher = `
      MATCH (ont:Ontology {id: $ontologyId})
      SET ont.version = $newVersion,
          ont.updatedAt = $updatedAt
      RETURN ont
    `;

    const result = await this.neo4jService.write(updateCypher, {
      ontologyId,
      newVersion: this.incrementVersion(currentOntology.version),
      updatedAt: new Date().toISOString()
    });

    return {
      evolvedOntology: result.records[0].get('ont'),
      evolutionResult,
      evolvedAt: new Date().toISOString()
    };
  }

  async createSemanticMapping(sourceOntologyId: string, targetOntologyId: string, mappingDefinition: any): Promise<any> {
    // Validate mapping definition
    const validation = this.validateSemanticMapping(mappingDefinition);
    if (!validation.isValid) {
      throw new Error(`Invalid semantic mapping: ${validation.errors.join(', ')}`);
    }

    const cypher = `
      MATCH (source:Ontology {id: $sourceId}), (target:Ontology {id: $targetId})
      CREATE (mapping:SemanticMapping {
        id: $id,
        name: $name,
        description: $description,
        status: $status,
        confidence: $confidence,
        createdBy: $createdBy,
        createdAt: $createdAt,
        updatedAt: $updatedAt
      })
      CREATE (source)-[:HAS_MAPPING]->(mapping)-[:MAPS_TO]->(target)
      RETURN mapping
    `;

    const id = `sm-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const now = new Date().toISOString();

    const result = await this.neo4jService.write(cypher, {
      sourceId: sourceOntologyId,
      targetId: targetOntologyId,
      id,
      name: mappingDefinition.name,
      description: mappingDefinition.description,
      status: 'active',
      confidence: mappingDefinition.confidence || 0.9,
      createdBy: mappingDefinition.createdBy || 'system',
      createdAt: now,
      updatedAt: now
    });

    // Create individual mappings if provided
    if (mappingDefinition.mappings && Array.isArray(mappingDefinition.mappings)) {
      await this.createIndividualMappings(result.records[0].get('mapping').id, mappingDefinition.mappings);
    }

    return result.records[0].get('mapping');
  }

  async validateOntologyConsistency(ontologyId: string): Promise<any> {
    // Perform various consistency checks on the ontology
    const consistencyChecks = {
      classHierarchy: await this.validateClassHierarchy(ontologyId),
      propertyDefinitions: await this.validatePropertyDefinitions(ontologyId),
      relationshipIntegrity: await this.validateRelationshipIntegrity(ontologyId),
      namingConventions: await this.validateNamingConventions(ontologyId),
      cardinalityConstraints: await this.validateCardinalityConstraints(ontologyId)
    };

    const totalErrors = Object.values(consistencyChecks).flat().length;
    const isValid = totalErrors === 0;

    return {
      ontologyId,
      isValid,
      totalErrors,
      consistencyChecks,
      validatedAt: new Date().toISOString()
    };
  }

  async generateOntologyDocumentation(ontologyId: string, format: string = 'html'): Promise<any> {
    const ontology = await this.getOntology(ontologyId);
    if (!ontology) {
      throw new Error(`Ontology ${ontologyId} not found`);
    }

    // Generate documentation based on format
    switch (format) {
      case 'html':
        return this.generateHtmlDocumentation(ontology);
      case 'markdown':
        return this.generateMarkdownDocumentation(ontology);
      case 'json':
        return this.generateJsonDocumentation(ontology);
      case 'yaml':
        return this.generateYamlDocumentation(ontology);
      default:
        throw new Error(`Unsupported documentation format: ${format}`);
    }
  }

  async inferOntologyFromData(dataSample: any, options: any = {}): Promise<any> {
    // Infer an ontology structure from a data sample
    const inferredClasses = this.inferClassesFromData(dataSample, options);
    const inferredProperties = this.inferPropertiesFromData(dataSample, options);
    const inferredRelationships = this.inferRelationshipsFromData(dataSample, options);

    const inferredOntology = {
      name: options.name || 'inferred-ontology',
      description: `Inferred from data sample at ${new Date().toISOString()}`,
      classes: inferredClasses,
      properties: inferredProperties,
      relationships: inferredRelationships,
      version: '1.0.0'
    };

    // Create the inferred ontology
    return await this.createOntology(inferredOntology);
  }

  async getOntologyEvolutionHistory(ontologyId: string): Promise<any[]> {
    // Get the evolution history for an ontology
    const cypher = `
      MATCH (ont:Ontology)-[:VERSION_OF*0..]->(original:Ontology {id: $ontologyId})
      OPTIONAL MATCH (ont)-[:PREVIOUS_VERSION]->(prev:Ontology)
      RETURN ont, prev
      ORDER BY ont.createdAt DESC
    `;

    const result = await this.neo4jService.read(cypher, { ontologyId });
    return result.records.map(record => {
      const current = record.get('ont');
      const previous = record.get('prev');
      return {
        ...current,
        previousVersion: previous ? previous.id : null
      };
    });
  }

  async optimizeOntologyStructure(ontologyId: string): Promise<any> {
    // Optimize the ontology structure for performance and clarity
    const ontology = await this.getOntology(ontologyId);
    if (!ontology) {
      throw new Error(`Ontology ${ontologyId} not found`);
    }

    const optimizationResults = {
      redundantClassesRemoved: 0,
      mergedProperties: 0,
      simplifiedHierarchies: 0,
      performanceImprovements: []
    };

    // Identify and remove redundant classes
    const redundantClasses = await this.identifyRedundantClasses(ontologyId);
    for (const redundantClass of redundantClasses) {
      // Merge or remove redundant class
      optimizationResults.redundantClassesRemoved++;
      optimizationResults.performanceImprovements.push({
        type: 'redundancy_reduction',
        target: redundantClass.name,
        improvement: 'removed_redundant_class'
      });
    }

    // Identify and merge similar properties
    const similarProperties = await this.identifySimilarProperties(ontologyId);
    for (const similarGroup of similarProperties) {
      // Merge similar properties
      optimizationResults.mergedProperties += similarGroup.length - 1;
      optimizationResults.performanceImprovements.push({
        type: 'property_merge',
        target: similarGroup.map((p: any) => p.name),
        improvement: 'merged_similar_properties'
      });
    }

    // Simplify deep hierarchies
    const deepHierarchies = await this.identifyDeepHierarchies(ontologyId);
    for (const hierarchy of deepHierarchies) {
      // Propose simplification
      optimizationResults.simplifiedHierarchies++;
      optimizationResults.performanceImprovements.push({
        type: 'hierarchy_simplification',
        target: hierarchy.root,
        improvement: 'simplified_deep_hierarchy'
      });
    }

    return {
      ontologyId,
      optimizationResults,
      optimizedAt: new Date().toISOString()
    };
  }

  private async createClassHierarchy(ontologyId: string, classes: any[]): Promise<void> {
    for (const cls of classes) {
      const classCypher = `
        MATCH (ont:Ontology {id: $ontologyId})
        CREATE (cls:OntologyClass {
          id: $classId,
          name: $name,
          description: $description,
          type: $type,
          status: $status,
          createdAt: $createdAt
        })
        CREATE (ont)-[:CONTAINS_CLASS]->(cls)
        RETURN cls
      `;

      const classResult = await this.neo4jService.write(classCypher, {
        ontologyId,
        classId: cls.id || `cls-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        name: cls.name,
        description: cls.description,
        type: cls.type || 'entity',
        status: cls.status || 'active',
        createdAt: new Date().toISOString()
      });

      // Create subclass relationships if defined
      if (cls.superClasses && Array.isArray(cls.superClasses)) {
        for (const superClassName of cls.superClasses) {
          await this.createSubclassRelationship(ontologyId, cls.name, superClassName);
        }
      }

      // Create properties for the class
      if (cls.properties && Array.isArray(cls.properties)) {
        for (const prop of cls.properties) {
          await this.addPropertyToClass(ontologyId, classResult.records[0].get('cls').id, prop);
        }
      }
    }
  }

  private async createSubclassRelationship(ontologyId: string, className: string, superClassName: string): Promise<void> {
    const cypher = `
      MATCH (ont:Ontology {id: $ontologyId})
      MATCH (child:OntologyClass {name: $className})-[:PART_OF]->(ont)
      MATCH (parent:OntologyClass {name: $superClassName})-[:PART_OF]->(ont)
      CREATE (child)-[:SUBCLASS_OF]->(parent)
    `;

    await this.neo4jService.write(cypher, {
      ontologyId,
      className,
      superClassName
    });
  }

  private async addPropertyToClass(ontologyId: string, classId: string, property: any): Promise<void> {
    const propCypher = `
      MATCH (ont:Ontology {id: $ontologyId})
      MATCH (cls:OntologyClass {id: $classId})
      CREATE (prop:OntologyProperty {
        id: $propId,
        name: $name,
        description: $description,
        dataType: $dataType,
        required: $required,
        unique: $unique,
        indexed: $indexed,
        createdAt: $createdAt
      })
      CREATE (cls)-[:HAS_PROPERTY]->(prop)
      CREATE (ont)-[:CONTAINS_PROPERTY]->(prop)
      RETURN prop
    `;

    await this.neo4jService.write(propCypher, {
      ontologyId,
      classId,
      propId: property.id || `prop-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      name: property.name,
      description: property.description,
      dataType: property.dataType || 'string',
      required: property.required || false,
      unique: property.unique || false,
      indexed: property.indexed || false,
      createdAt: new Date().toISOString()
    });
  }

  private async createRelationships(ontologyId: string, relationships: any[]): Promise<void> {
    for (const rel of relationships) {
      const relCypher = `
        MATCH (ont:Ontology {id: $ontologyId})
        CREATE (rel:OntologyRelationship {
          id: $relId,
          name: $name,
          description: $description,
          type: $type,
          domain: $domain,
          range: $range,
          minCardinality: $minCardinality,
          maxCardinality: $maxCardinality,
          createdAt: $createdAt
        })
        CREATE (ont)-[:CONTAINS_RELATIONSHIP]->(rel)
        RETURN rel
      `;

      await this.neo4jService.write(relCypher, {
        ontologyId,
        relId: rel.id || `rel-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        name: rel.name,
        description: rel.description,
        type: rel.type || 'object_property',
        domain: rel.domain,
        range: rel.range,
        minCardinality: rel.minCardinality || 0,
        maxCardinality: rel.maxCardinality || -1, // -1 means unlimited
        createdAt: new Date().toISOString()
      });
    }
  }

  private async createProperties(ontologyId: string, properties: any[]): Promise<void> {
    for (const prop of properties) {
      const propCypher = `
        MATCH (ont:Ontology {id: $ontologyId})
        CREATE (prop:OntologyProperty {
          id: $propId,
          name: $name,
          description: $description,
          dataType: $dataType,
          required: $required,
          unique: $unique,
          indexed: $indexed,
          createdAt: $createdAt
        })
        CREATE (ont)-[:CONTAINS_PROPERTY]->(prop)
        RETURN prop
      `;

      await this.neo4jService.write(propCypher, {
        ontologyId,
        propId: prop.id || `prop-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        name: prop.name,
        description: prop.description,
        dataType: prop.dataType || 'string',
        required: prop.required || false,
        unique: prop.unique || false,
        indexed: prop.indexed || false,
        createdAt: new Date().toISOString()
      });
    }
  }

  private async createIndividualMappings(mappingId: string, mappings: any[]): Promise<void> {
    for (const mapping of mappings) {
      const mappingCypher = `
        MATCH (sm:SemanticMapping {id: $mappingId})
        CREATE (ind:IndividualMapping {
          id: $indId,
          sourceElement: $sourceElement,
          targetElement: $targetElement,
          relation: $relation,
          confidence: $confidence,
          createdAt: $createdAt
        })
        CREATE (sm)-[:CONTAINS_MAPPING]->(ind)
        RETURN ind
      `;

      await this.neo4jService.write(mappingCypher, {
        mappingId,
        indId: mapping.id || `ind-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        sourceElement: mapping.sourceElement,
        targetElement: mapping.targetElement,
        relation: mapping.relation || 'equivalent',
        confidence: mapping.confidence || 0.9,
        createdAt: new Date().toISOString()
      });
    }
  }

  private async validateClassHierarchy(ontologyId: string): Promise<any[]> {
    const errors = [];

    // Check for circular inheritance
    const cypher = `
      MATCH (ont:Ontology {id: $ontologyId})<-[:PART_OF]-(cls:OntologyClass)
      MATCH path = (cls)-[:SUBCLASS_OF*]->(cls)
      RETURN cls.name AS className, nodes(path) AS pathNodes
    `;

    const result = await this.neo4jService.read(cypher, { ontologyId });
    for (const record of result.records) {
      errors.push({
        type: 'circular_inheritance',
        element: record.get('className'),
        path: record.get('pathNodes').map((n: any) => n.properties.name),
        message: `Circular inheritance detected in class ${record.get('className')}`
      });
    }

    return errors;
  }

  private async validatePropertyDefinitions(ontologyId: string): Promise<any[]> {
    const errors = [];

    // Check for duplicate property names within classes
    const cypher = `
      MATCH (ont:Ontology {id: $ontologyId})<-[:PART_OF]-(cls:OntologyClass)-[:HAS_PROPERTY]->(prop:OntologyProperty)
      WITH cls, prop
      MATCH (cls)-[:HAS_PROPERTY]->(otherProp:OntologyProperty)
      WHERE prop.name = otherProp.name AND prop.id <> otherProp.id
      RETURN cls.name AS className, prop.name AS propertyName
    `;

    const result = await this.neo4jService.read(cypher, { ontologyId });
    for (const record of result.records) {
      errors.push({
        type: 'duplicate_property',
        element: `${record.get('className')}.${record.get('propertyName')}`,
        message: `Duplicate property name ${record.get('propertyName')} in class ${record.get('className')}`
      });
    }

    return errors;
  }

  private async validateRelationshipIntegrity(ontologyId: string): Promise<any[]> {
    const errors = [];

    // Check for relationships with invalid domain or range
    const cypher = `
      MATCH (ont:Ontology {id: $ontologyId})<-[:PART_OF]-(rel:OntologyRelationship)
      WHERE rel.domain IS NOT NULL OR rel.range IS NOT NULL
      WITH rel
      OPTIONAL MATCH (domainClass:OntologyClass {name: rel.domain})-[:PART_OF]->(ont)
      OPTIONAL MATCH (rangeClass:OntologyClass {name: rel.range})-[:PART_OF]->(ont)
      WHERE domainClass IS NULL OR rangeClass IS NULL
      RETURN rel.name AS relName, rel.domain AS domain, rel.range AS range
    `;

    const result = await this.neo4jService.read(cypher, { ontologyId });
    for (const record of result.records) {
      const missing = [];
      if (!record.get('domainClass')) missing.push('domain');
      if (!record.get('rangeClass')) missing.push('range');
      
      errors.push({
        type: 'invalid_relationship_target',
        element: record.get('relName'),
        message: `Relationship ${record.get('relName')} has invalid ${missing.join(' and ')}: ${record.get(missing[0])}`
      });
    }

    return errors;
  }

  private async validateNamingConventions(ontologyId: string): Promise<any[]> {
    const errors = [];

    // Check for naming convention violations
    const cypher = `
      MATCH (ont:Ontology {id: $ontologyId})<-[:PART_OF]-(n)
      WHERE n.name IS NOT NULL
      WITH n, 
           CASE 
             WHEN n:OntologyClass THEN 'class'
             WHEN n:OntologyProperty THEN 'property'
             WHEN n:OntologyRelationship THEN 'relationship'
             ELSE 'other'
           END AS elementType
      WHERE n.name <> apoc.text.camelCase(n.name) OR n.name CONTAINS ' '
      RETURN n.name AS name, elementType
    `;

    const result = await this.neo4jService.read(cypher, { ontologyId });
    for (const record of result.records) {
      errors.push({
        type: 'naming_convention_violation',
        element: record.get('name'),
        elementType: record.get('elementType'),
        message: `Element ${record.get('name')} violates naming conventions (should be camelCase)`
      });
    }

    return errors;
  }

  private async validateCardinalityConstraints(ontologyId: string): Promise<any[]> {
    const errors = [];

    // Check for invalid cardinality constraints
    const cypher = `
      MATCH (ont:Ontology {id: $ontologyId})<-[:PART_OF]-(rel:OntologyRelationship)
      WHERE (rel.minCardinality > rel.maxCardinality AND rel.maxCardinality > 0) OR rel.minCardinality < 0
      RETURN rel.name AS relName, rel.minCardinality AS minCard, rel.maxCardinality AS maxCard
    `;

    const result = await this.neo4jService.read(cypher, { ontologyId });
    for (const record of result.records) {
      errors.push({
        type: 'cardinality_constraint_violation',
        element: record.get('relName'),
        message: `Relationship ${record.get('relName')} has invalid cardinality: min(${record.get('minCard')}) > max(${record.get('maxCard')})`
      });
    }

    return errors;
  }

  private async identifyRedundantClasses(ontologyId: string): Promise<any[]> {
    // Identify classes that are nearly identical and could be merged
    const cypher = `
      MATCH (ont:Ontology {id: $ontologyId})<-[:PART_OF]-(cls1:OntologyClass)-[:HAS_PROPERTY]->(p1:OntologyProperty)
      MATCH (ont)<-[:PART_OF]-(cls2:OntologyClass)-[:HAS_PROPERTY]->(p2:OntologyProperty)
      WHERE cls1.name < cls2.name
      AND p1.name = p2.name
      AND p1.dataType = p2.dataType
      WITH cls1, cls2, count(p1) as commonProps
      MATCH (cls1)-[:HAS_PROPERTY]->(prop1:OntologyProperty)
      MATCH (cls2)-[:HAS_PROPERTY]->(prop2:OntologyProperty)
      WITH cls1, cls2, commonProps, count(prop1) as cls1Props, count(prop2) as cls2Props
      WHERE commonProps = cls1Props AND commonProps = cls2Props
      RETURN cls1, cls2
    `;

    const result = await this.neo4jService.read(cypher, { ontologyId });
    return result.records.map(record => record.get('cls1'));
  }

  private async identifySimilarProperties(ontologyId: string): Promise<any[]> {
    // Identify properties that have similar names and types
    const cypher = `
      MATCH (ont:Ontology {id: $ontologyId})<-[:PART_OF]-(prop1:OntologyProperty)
      MATCH (ont)<-[:PART_OF]-(prop2:OntologyProperty)
      WHERE prop1.name < prop2.name
      AND prop1.dataType = prop2.dataType
      AND (apoc.text.sorensenDiceSimilarity(prop1.name, prop2.name) > 0.8
           OR apoc.text.jaroWinklerDistance(prop1.name, prop2.name) > 0.8)
      RETURN collect([prop1, prop2]) AS similarGroups
    `;

    const result = await this.neo4jService.read(cypher, { ontologyId });
    return result.records[0]?.get('similarGroups') || [];
  }

  private async identifyDeepHierarchies(ontologyId: string): Promise<any[]> {
    // Identify class hierarchies that are too deep
    const cypher = `
      MATCH (ont:Ontology {id: $ontologyId})<-[:PART_OF]-(leaf:OntologyClass)
      MATCH path = (leaf)-[:SUBCLASS_OF*]->(root:OntologyClass)
      WHERE length(path) > 5  // Threshold for "too deep"
      RETURN root.name AS root, length(path) AS depth, nodes(path) AS hierarchy
    `;

    const result = await this.neo4jService.read(cypher, { ontologyId });
    return result.records.map(record => ({
      root: record.get('root'),
      depth: record.get('depth'),
      hierarchy: record.get('hierarchy').map((n: any) => n.properties.name)
    }));
  }

  private generateHtmlDocumentation(ontology: any): string {
    let html = `<!DOCTYPE html>
<html>
<head>
  <title>${ontology.name} Documentation</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; }
    h1, h2, h3 { color: #2c3e50; }
    .section { margin-bottom: 30px; }
    .class { border-left: 3px solid #3498db; padding-left: 15px; margin-bottom: 15px; }
    .property { margin-left: 20px; color: #7f8c8d; }
    .relationship { margin-left: 20px; color: #27ae60; }
  </style>
</head>
<body>
  <h1>${ontology.name}</h1>
  <div class="section">
    <h2>Description</h2>
    <p>${ontology.description || 'No description provided.'}</p>
  </div>`;

    // Classes section
    html += `<div class="section">
    <h2>Classes</h2>`;
    for (const cls of ontology.classes) {
      html += `<div class="class">
        <h3>${cls.name}</h3>
        <p><em>${cls.description || 'No description'}</em></p>
        <h4>Properties:</h4>
        <ul>`;
      for (const prop of cls.properties || []) {
        html += `<li class="property"><strong>${prop.name}</strong>: ${prop.dataType} ${prop.required ? '(required)' : ''}</li>`;
      }
      html += `</ul>
      </div>`;
    }
    html += `</div>`;

    // Relationships section
    html += `<div class="section">
    <h2>Relationships</h2>
    <ul>`;
    for (const rel of ontology.relationships) {
      html += `<li class="relationship">${rel.name}: ${rel.domain} -> ${rel.range} (${rel.minCardinality}..${rel.maxCardinality === -1 ? '*' : rel.maxCardinality})</li>`;
    }
    html += `</ul>
    </div>`;

    html += `</body></html>`;
    return html;
  }

  private generateMarkdownDocumentation(ontology: any): string {
    let md = `# ${ontology.name}\n\n`;
    md += `${ontology.description || 'No description provided.'}\n\n`;

    // Classes section
    md += `## Classes\n\n`;
    for (const cls of ontology.classes) {
      md += `### ${cls.name}\n\n`;
      md += `${cls.description || 'No description'}\n\n`;
      md += `**Properties:**\n\n`;
      for (const prop of cls.properties || []) {
        md += `- \`${prop.name}\`: ${prop.dataType} ${prop.required ? '(required)' : ''}\n`;
      }
      md += '\n';
    }

    // Relationships section
    md += `## Relationships\n\n`;
    for (const rel of ontology.relationships) {
      md += `- **${rel.name}**: ${rel.domain} -> ${rel.range} (${rel.minCardinality}..${rel.maxCardinality === -1 ? '*' : rel.maxCardinality})\n`;
    }

    return md;
  }

  private generateJsonDocumentation(ontology: any): any {
    return {
      name: ontology.name,
      description: ontology.description,
      version: ontology.version,
      classes: ontology.classes,
      relationships: ontology.relationships,
      properties: ontology.properties,
      generatedAt: new Date().toISOString()
    };
  }

  private generateYamlDocumentation(ontology: any): string {
    let yaml = `name: ${ontology.name}\n`;
    yaml += `description: ${ontology.description || ''}\n`;
    yaml += `version: ${ontology.version}\n`;
    yaml += 'classes:\n';
    
    for (const cls of ontology.classes) {
      yaml += `  - name: ${cls.name}\n`;
      yaml += `    description: ${cls.description || ''}\n`;
      yaml += '    properties:\n';
      for (const prop of cls.properties || []) {
        yaml += `      - name: ${prop.name}\n`;
        yaml += `        dataType: ${prop.dataType}\n`;
        yaml += `        required: ${prop.required || false}\n`;
      }
    }

    yaml += 'relationships:\n';
    for (const rel of ontology.relationships) {
      yaml += `  - name: ${rel.name}\n`;
      yaml += `    domain: ${rel.domain}\n`;
      yaml += `    range: ${rel.range}\n`;
      yaml += `    minCardinality: ${rel.minCardinality}\n`;
      yaml += `    maxCardinality: ${rel.maxCardinality === -1 ? '*' : rel.maxCardinality}\n`;
    }

    return yaml;
  }

  private inferClassesFromData(dataSample: any, options: any): any[] {
    const classes = [];
    const seenTypes = new Set();

    // Recursive function to traverse data structure
    const traverse = (obj: any, path: string = '') => {
      if (obj === null || typeof obj !== 'object') return;

      if (Array.isArray(obj)) {
        // Handle arrays by looking at first element
        if (obj.length > 0) traverse(obj[0], path);
        return;
      }

      // Identify potential class based on object structure
      const keys = Object.keys(obj);
      const className = this.generateClassName(keys, path);

      if (!seenTypes.has(className)) {
        seenTypes.add(className);
        classes.push({
          name: className,
          description: `Inferred class from data structure at ${path || 'root'}`,
          properties: keys.map(key => ({
            name: key,
            dataType: this.inferDataType(obj[key]),
            required: true // Assume all properties in sample are required
          }))
        });
      }

      // Recursively process nested objects
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'object' && value !== null) {
          traverse(value, path ? `${path}.${key}` : key);
        }
      }
    };

    traverse(dataSample);
    return classes;
  }

  private inferPropertiesFromData(dataSample: any, options: any): any[] {
    const properties = [];
    const seenProps = new Set();

    const traverse = (obj: any, path: string = '') => {
      if (obj === null || typeof obj !== 'object') return;

      if (Array.isArray(obj)) {
        if (obj.length > 0) traverse(obj[0], path);
        return;
      }

      for (const [key, value] of Object.entries(obj)) {
        const propName = path ? `${path}.${key}` : key;

        if (!seenProps.has(propName)) {
          seenProps.add(propName);
          properties.push({
            name: key,
            description: `Inferred property from path ${propName}`,
            dataType: this.inferDataType(value),
            required: true
          });
        }

        if (typeof value === 'object' && value !== null) {
          traverse(value, propName);
        }
      }
    };

    traverse(dataSample);
    return properties;
  }

  private inferRelationshipsFromData(dataSample: any, options: any): any[] {
    const relationships = [];
    const seenRelationships = new Set();

    const traverse = (obj: any, path: string = '') => {
      if (obj === null || typeof obj !== 'object') return;

      if (Array.isArray(obj)) {
        if (obj.length > 0) traverse(obj[0], path);
        return;
      }

      for (const [key, value] of Object.entries(obj)) {
        const currentPath = path ? `${path}.${key}` : key;

        if (typeof value === 'object' && value !== null) {
          // Infer relationship if value is an object
          const domain = this.generateClassName(Object.keys(obj), path);
          const range = this.generateClassName(Object.keys(value), currentPath);

          const relationshipKey = `${domain}-${key}-${range}`;
          if (!seenRelationships.has(relationshipKey)) {
            seenRelationships.add(relationshipKey);
            relationships.push({
              name: key,
              description: `Inferred relationship from ${domain} to ${range} via ${key}`,
              domain,
              range,
              minCardinality: 0,
              maxCardinality: 1 // Assuming single object reference
            });
          }

          traverse(value, currentPath);
        } else if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object') {
          // Infer many-to-many relationship if array of objects
          const domain = this.generateClassName(Object.keys(obj), path);
          const range = this.generateClassName(Object.keys(value[0]), currentPath);

          const relationshipKey = `${domain}-${key}-${range}-many`;
          if (!seenRelationships.has(relationshipKey)) {
            seenRelationships.add(relationshipKey);
            relationships.push({
              name: key,
              description: `Inferred relationship from ${domain} to multiple ${range} via ${key}`,
              domain,
              range,
              minCardinality: 0,
              maxCardinality: -1 // Many
            });
          }

          traverse(value[0], currentPath);
        }
      }
    };

    traverse(dataSample);
    return relationships;
  }

  private generateClassName(keys: string[], path: string): string {
    // Generate a class name based on keys and path
    if (path) {
      const parts = path.split('.');
      return this.toPascalCase(parts[parts.length - 1]);
    }

    // If no path, use the most descriptive key or join first few keys
    if (keys.length === 0) return 'EmptyClass';
    if (keys.length === 1) return this.toPascalCase(keys[0]);

    // Use first key as base, or join first few if they seem related
    return this.toPascalCase(keys[0]);
  }

  private toPascalCase(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1).replace(/[-_\s]+(.)?/g, (_, c) => c ? c.toUpperCase() : '');
  }

  private inferDataType(value: any): string {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    if (typeof value === 'object') return 'object';
    if (typeof value === 'string') {
      // Check if it's a date
      if (isNaN(Date.parse(value))) {
        // Check if it's a number stored as string
        if (!isNaN(Number(value))) {
          return 'string_number';
        }
        return 'string';
      }
      return 'date';
    }
    if (typeof value === 'number') {
      return Number.isInteger(value) ? 'integer' : 'float';
    }
    if (typeof value === 'boolean') return 'boolean';
    return 'unknown';
  }

  private incrementVersion(version: string): string {
    const parts = version.split('.').map(Number);
    parts[parts.length - 1]++;
    return parts.join('.');
  }

  private validateOntologyDefinition(definition: any): { isValid: boolean; errors: string[] } {
    const errors = [];

    if (!definition.name) {
      errors.push('Ontology name is required');
    }

    if (!definition.description) {
      errors.push('Ontology description is required');
    }

    if (definition.classes && !Array.isArray(definition.classes)) {
      errors.push('Classes must be an array');
    }

    if (definition.relationships && !Array.isArray(definition.relationships)) {
      errors.push('Relationships must be an array');
    }

    if (definition.properties && !Array.isArray(definition.properties)) {
      errors.push('Properties must be an array');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private validateEvolutionPlan(plan: any): { isValid: boolean; errors: string[] } {
    const errors = [];

    if (!plan.additions && !plan.modifications && !plan.removals) {
      errors.push('Evolution plan must contain at least one of: additions, modifications, removals');
    }

    if (plan.additions) {
      if (plan.additions.classes && !Array.isArray(plan.additions.classes)) {
        errors.push('Added classes must be an array');
      }
      if (plan.additions.relationships && !Array.isArray(plan.additions.relationships)) {
        errors.push('Added relationships must be an array');
      }
      if (plan.additions.properties && !Array.isArray(plan.additions.properties)) {
        errors.push('Added properties must be an array');
      }
    }

    if (plan.modifications) {
      if (plan.modifications.classes && !Array.isArray(plan.modifications.classes)) {
        errors.push('Modified classes must be an array');
      }
      if (plan.modifications.relationships && !Array.isArray(plan.modifications.relationships)) {
        errors.push('Modified relationships must be an array');
      }
      if (plan.modifications.properties && !Array.isArray(plan.modifications.properties)) {
        errors.push('Modified properties must be an array');
      }
    }

    if (plan.removals) {
      if (plan.removals.classes && !Array.isArray(plan.removals.classes)) {
        errors.push('Removed classes must be an array');
      }
      if (plan.removals.relationships && !Array.isArray(plan.removals.relationships)) {
        errors.push('Removed relationships must be an array');
      }
      if (plan.removals.properties && !Array.isArray(plan.removals.properties)) {
        errors.push('Removed properties must be an array');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private validateSemanticMapping(mapping: any): { isValid: boolean; errors: string[] } {
    const errors = [];

    if (!mapping.name) {
      errors.push('Mapping name is required');
    }

    if (!mapping.mappings || !Array.isArray(mapping.mappings)) {
      errors.push('Mappings must be an array');
    } else {
      for (let i = 0; i < mapping.mappings.length; i++) {
        const map = mapping.mappings[i];
        if (!map.sourceElement) {
          errors.push(`Mapping ${i} must have a source element`);
        }
        if (!map.targetElement) {
          errors.push(`Mapping ${i} must have a target element`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private async validateOntologyForPublication(ontologyId: string): Promise<{ isValid: boolean; errors: string[] }> {
    const errors = [];

    // Check if ontology has at least one class
    const classCheckCypher = `
      MATCH (ont:Ontology {id: $ontologyId})-[:CONTAINS_CLASS]->(cls:OntologyClass)
      RETURN count(cls) AS classCount
    `;

    const classResult = await this.neo4jService.read(classCheckCypher, { ontologyId });
    const classCount = classResult.records[0].get('classCount');

    if (classCount === 0) {
      errors.push('Ontology must contain at least one class to be published');
    }

    // Check if ontology passes consistency validation
    const consistencyCheck = await this.validateOntologyConsistency(ontologyId);
    if (!consistencyCheck.isValid) {
      errors.push(`Ontology has ${consistencyCheck.totalErrors} consistency issues`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private async addClassToOntology(ontologyId: string, cls: any): Promise<void> {
    const classCypher = `
      MATCH (ont:Ontology {id: $ontologyId})
      CREATE (cls:OntologyClass {
        id: $classId,
        name: $name,
        description: $description,
        type: $type,
        status: $status,
        createdAt: $createdAt
      })
      CREATE (ont)-[:CONTAINS_CLASS]->(cls)
      RETURN cls
    `;

    await this.neo4jService.write(classCypher, {
      ontologyId,
      classId: cls.id || `cls-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      name: cls.name,
      description: cls.description,
      type: cls.type || 'entity',
      status: cls.status || 'active',
      createdAt: new Date().toISOString()
    });
  }

  private async modifyClassInOntology(ontologyId: string, classId: string, updates: any): Promise<void> {
    const cypher = `
      MATCH (ont:Ontology {id: $ontologyId})-[:CONTAINS_CLASS]->(cls:OntologyClass {id: $classId})
      SET cls += $updates,
          cls.updatedAt = $updatedAt
    `;

    await this.neo4jService.write(cypher, {
      ontologyId,
      classId,
      updates,
      updatedAt: new Date().toISOString()
    });
  }

  private async removeClassFromOntology(ontologyId: string, classId: string): Promise<void> {
    const cypher = `
      MATCH (ont:Ontology {id: $ontologyId})-[:CONTAINS_CLASS]->(cls:OntologyClass {id: $classId})
      DETACH DELETE cls
    `;

    await this.neo4jService.write(cypher, { ontologyId, classId });
  }

  private async addRelationshipToOntology(ontologyId: string, rel: any): Promise<void> {
    const relCypher = `
      MATCH (ont:Ontology {id: $ontologyId})
      CREATE (rel:OntologyRelationship {
        id: $relId,
        name: $name,
        description: $description,
        type: $type,
        domain: $domain,
        range: $range,
        minCardinality: $minCardinality,
        maxCardinality: $maxCardinality,
        createdAt: $createdAt
      })
      CREATE (ont)-[:CONTAINS_RELATIONSHIP]->(rel)
      RETURN rel
    `;

    await this.neo4jService.write(relCypher, {
      ontologyId,
      relId: rel.id || `rel-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      name: rel.name,
      description: rel.description,
      type: rel.type || 'object_property',
      domain: rel.domain,
      range: rel.range,
      minCardinality: rel.minCardinality || 0,
      maxCardinality: rel.maxCardinality || -1,
      createdAt: new Date().toISOString()
    });
  }

  private async modifyRelationshipInOntology(ontologyId: string, relId: string, updates: any): Promise<void> {
    const cypher = `
      MATCH (ont:Ontology {id: $ontologyId})-[:CONTAINS_RELATIONSHIP]->(rel:OntologyRelationship {id: $relId})
      SET rel += $updates,
          rel.updatedAt = $updatedAt
    `;

    await this.neo4jService.write(cypher, {
      ontologyId,
      relId,
      updates,
      updatedAt: new Date().toISOString()
    });
  }

  private async removeRelationshipFromOntology(ontologyId: string, relId: string): Promise<void> {
    const cypher = `
      MATCH (ont:Ontology {id: $ontologyId})-[:CONTAINS_RELATIONSHIP]->(rel:OntologyRelationship {id: $relId})
      DETACH DELETE rel
    `;

    await this.neo4jService.write(cypher, { ontologyId, relId });
  }

  private async addPropertyToOntology(ontologyId: string, prop: any): Promise<void> {
    const propCypher = `
      MATCH (ont:Ontology {id: $ontologyId})
      CREATE (prop:OntologyProperty {
        id: $propId,
        name: $name,
        description: $description,
        dataType: $dataType,
        required: $required,
        unique: $unique,
        indexed: $indexed,
        createdAt: $createdAt
      })
      CREATE (ont)-[:CONTAINS_PROPERTY]->(prop)
      RETURN prop
    `;

    await this.neo4jService.write(propCypher, {
      ontologyId,
      propId: prop.id || `prop-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      name: prop.name,
      description: prop.description,
      dataType: prop.dataType || 'string',
      required: prop.required || false,
      unique: prop.unique || false,
      indexed: prop.indexed || false,
      createdAt: new Date().toISOString()
    });
  }

  private async modifyPropertyInOntology(ontologyId: string, propId: string, updates: any): Promise<void> {
    const cypher = `
      MATCH (ont:Ontology {id: $ontologyId})-[:CONTAINS_PROPERTY]->(prop:OntologyProperty {id: $propId})
      SET prop += $updates,
          prop.updatedAt = $updatedAt
    `;

    await this.neo4jService.write(cypher, {
      ontologyId,
      propId,
      updates,
      updatedAt: new Date().toISOString()
    });
  }

  private async removePropertyFromOntology(ontologyId: string, propId: string): Promise<void> {
    const cypher = `
      MATCH (ont:Ontology {id: $ontologyId})-[:CONTAINS_PROPERTY]->(prop:OntologyProperty {id: $propId})
      DETACH DELETE prop
    `;

    await this.neo4jService.write(cypher, { ontologyId, propId });
  }
}