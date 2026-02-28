import { Injectable } from '@nestjs/common';
import { Neo4jService } from 'nest-neo4j';

@Injectable()
export class KnowledgeGraphService {
  constructor(private neo4jService: Neo4jService) {}

  async buildKnowledgeGraph(ontology: any, data: any[]): Promise<any> {
    // Create nodes for each entity in the data
    for (const item of data) {
      const entityDef = ontology.entities.find((e: any) => e.name === item.type);
      if (entityDef) {
        // Create the node
        await this.createNodeFromEntity(item, entityDef);
      }
    }

    // Create relationships based on the ontology
    if (ontology.relationships) {
      for (const relationship of ontology.relationships) {
        await this.createRelationshipsFromData(data, relationship);
      }
    }

    return { success: true, message: 'Knowledge graph built successfully' };
  }

  async createNodeFromEntity(entityData: any, entityDef: any): Promise<any> {
    const props = this.formatProperties(entityData.properties || entityData);
    
    // Build Cypher query to create node
    const labels = [`\`${entityDef.name}\``];
    if (entityData.tags) {
      entityData.tags.forEach((tag: string) => labels.push(`\`${tag}\``));
    }
    
    const labelStr = labels.join(':');
    const propStr = this.buildProps(props);
    
    const cypher = `CREATE (n:${labelStr} ${propStr}) RETURN id(n) AS id`;
    const result = await this.neo4jService.write(cypher, {});
    
    return { nodeId: result.records[0]?.get('id'), entity: entityData };
  }

  async createRelationshipsFromData(data: any[], relationshipDef: any): Promise<void> {
    // Find pairs of entities that should be related
    for (const item of data) {
      if (item.type === relationshipDef.fromEntity) {
        // Find related entities
        const relatedItems = data.filter((d: any) => 
          d.type === relationshipDef.toEntity && 
          this.checkRelationshipCondition(item, d, relationshipDef)
        );

        for (const relatedItem of relatedItems) {
          await this.createRelationship(
            item.id,
            relatedItem.id,
            relationshipDef.name,
            relationshipDef.properties || {}
          );
        }
      }
    }
  }

  private checkRelationshipCondition(fromEntity: any, toEntity: any, relationship: any): boolean {
    // Simple condition checking - in real implementation, this would be more sophisticated
    // For now, we'll assume a relationship exists if both entities have compatible IDs
    return true;
  }

  async createRelationship(
    fromId: string, 
    toId: string, 
    relationshipType: string, 
    properties: any = {}
  ): Promise<any> {
    const propStr = this.buildProps(properties);
    
    const cypher = `
      MATCH (from), (to)
      WHERE id(from) = $fromId AND id(to) = $toId
      CREATE (from)-[r:\`${relationshipType}\`${propStr}]->(to)
      RETURN id(r) AS id
    `;
    
    const result = await this.neo4jService.write(cypher, { fromId: parseInt(fromId), toId: parseInt(toId) });
    
    return { relId: result.records[0]?.get('id') };
  }

  async queryKnowledgeGraph(cypher: string, params: any = {}): Promise<any[]> {
    const result = await this.neo4jService.read(cypher, params);
    return result.records.map(record => this.formatRecord(record));
  }

  async findRelatedEntities(entityId: string, relationshipType?: string, direction: 'in' | 'out' | 'both' = 'both'): Promise<any[]> {
    let relPattern = relationshipType ? `[:\`${relationshipType}\`]` : '[*]';
    
    let cypher = '';
    switch (direction) {
      case 'in':
        cypher = `MATCH (related)-${relPattern}->(n) WHERE id(n) = $entityId RETURN related`;
        break;
      case 'out':
        cypher = `MATCH (n)-${relPattern}->(related) WHERE id(n) = $entityId RETURN related`;
        break;
      case 'both':
        cypher = `MATCH (n)-${relPattern}-(related) WHERE id(n) = $entityId RETURN related`;
        break;
    }
    
    const result = await this.neo4jService.read(cypher, { entityId: parseInt(entityId) });
    return result.records.map(record => record.get('related'));
  }

  async searchKnowledgeGraph(searchTerm: string, entityTypes: string[] = []): Promise<any[]> {
    let typeFilter = '';
    if (entityTypes.length > 0) {
      const labels = entityTypes.map(t => `n:\`${t}\``).join(' OR ');
      typeFilter = `WHERE ${labels}`;
    }
    
    const cypher = `
      MATCH (n)
      ${typeFilter}
      WHERE ANY(prop IN keys(n) WHERE toString(n[prop]) CONTAINS $searchTerm)
      RETURN n, labels(n) AS nodeLabels
    `;
    
    const result = await this.neo4jService.read(cypher, { searchTerm });
    return result.records.map(record => ({
      node: record.get('n'),
      labels: record.get('nodeLabels'),
    }));
  }

  async getKnowledgeGraphInsights(): Promise<any> {
    // Get insights about the knowledge graph
    const nodeCountResult = await this.neo4jService.read('MATCH (n) RETURN count(n) AS count', {});
    const relCountResult = await this.neo4jService.read('MATCH ()-[r]->() RETURN count(r) AS count', {});
    const avgRelPerNode = nodeCountResult.records[0]?.get('count') > 0 
      ? relCountResult.records[0]?.get('count') / nodeCountResult.records[0]?.get('count') 
      : 0;
    
    // Get most connected nodes
    const centralNodesResult = await this.neo4jService.read(`
      MATCH (n)
      OPTIONAL MATCH (n)-[]-()
      WITH n, count(*) AS relCount
      RETURN n, relCount
      ORDER BY relCount DESC
      LIMIT 10
    `, {});
    
    const centralNodes = centralNodesResult.records.map(record => ({
      node: record.get('n'),
      connections: record.get('relCount'),
    }));
    
    // Get relationship types distribution
    const relTypesResult = await this.neo4jService.read(`
      MATCH ()-[r]->()
      RETURN type(r) AS type, count(r) AS count
      ORDER BY count DESC
    `, {});
    
    const relationshipDistribution = relTypesResult.records.map(record => ({
      type: record.get('type'),
      count: record.get('count'),
    }));
    
    return {
      totalNodes: nodeCountResult.records[0]?.get('count') || 0,
      totalRelationships: relCountResult.records[0]?.get('count') || 0,
      averageConnectionsPerNode: avgRelPerNode,
      mostCentralNodes: centralNodes,
      relationshipDistribution,
    };
  }

  async exportKnowledgeGraph(format: 'json' | 'csv' | 'graphml' = 'json'): Promise<any> {
    switch (format) {
      case 'json':
        return await this.exportAsJson();
      case 'csv':
        return await this.exportAsCsv();
      case 'graphml':
        return await this.exportAsGraphML();
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  private async exportAsJson(): Promise<any> {
    // Export the entire graph as JSON
    const nodesResult = await this.neo4jService.read('MATCH (n) RETURN n, labels(n) AS labels', {});
    const relsResult = await this.neo4jService.read('MATCH ()-[r]->() RETURN r, startNode(r) AS from, endNode(r) AS to', {});
    
    const nodes = nodesResult.records.map(record => ({
      id: record.get('n').identity.toInt(),
      labels: record.get('labels'),
      properties: record.get('n').properties,
    }));
    
    const relationships = relsResult.records.map(record => ({
      id: record.get('r').identity.toInt(),
      type: record.get('r').type,
      startNodeId: record.get('from').identity.toInt(),
      endNodeId: record.get('to').identity.toInt(),
      properties: record.get('r').properties,
    }));
    
    return { nodes, relationships };
  }

  private async exportAsCsv(): Promise<any> {
    // Export nodes and relationships as separate CSV files
    const nodesResult = await this.neo4jService.read('MATCH (n) RETURN n, labels(n) AS labels', {});
    const relsResult = await this.neo4jService.read('MATCH ()-[r]->() RETURN r, startNode(r) AS from, endNode(r) AS to', {});
    
    // Format as CSV data
    const nodeHeaders = ['id', 'labels', 'properties'];
    const nodeRows = nodesResult.records.map(record => [
      record.get('n').identity.toInt(),
      `"${record.get('labels').join(';')}"`,
      JSON.stringify(record.get('n').properties),
    ]);
    
    const relHeaders = ['id', 'type', 'startNodeId', 'endNodeId', 'properties'];
    const relRows = relsResult.records.map(record => [
      record.get('r').identity.toInt(),
      record.get('r').type,
      record.get('from').identity.toInt(),
      record.get('to').identity.toInt(),
      JSON.stringify(record.get('r').properties),
    ]);
    
    return {
      nodes: [nodeHeaders, ...nodeRows],
      relationships: [relHeaders, ...relRows],
    };
  }

  private async exportAsGraphML(): Promise<any> {
    // Export as GraphML format
    // This is a simplified implementation
    const nodesResult = await this.neo4jService.read('MATCH (n) RETURN n, labels(n) AS labels', {});
    const relsResult = await this.neo4jService.read('MATCH ()-[r]->() RETURN r, startNode(r) AS from, endNode(r) AS to', {});
    
    let graphML = `<?xml version="1.0" encoding="UTF-8"?>
    <graphml xmlns="http://graphml.graphdrawing.org/xmlns">
      <graph id="knowledge_graph" edgedefault="directed">
    `;
    
    // Add nodes
    for (const record of nodesResult.records) {
      const node = record.get('n');
      const labels = record.get('labels');
      graphML += `
        <node id="${node.identity.toInt()}">
          <data key="labels">${labels.join(',')}</data>
        </node>
      `;
    }
    
    // Add relationships
    for (const record of relsResult.records) {
      const rel = record.get('r');
      const fromId = record.get('from').identity.toInt();
      const toId = record.get('to').identity.toInt();
      graphML += `
        <edge id="${rel.identity.toInt()}" source="${fromId}" target="${toId}">
          <data key="type">${rel.type}</data>
        </edge>
      `;
    }
    
    graphML += `
      </graph>
    </graphml>
    `;
    
    return graphML;
  }

  private formatProperties(props: any): any {
    const formatted = {};
    for (const [key, value] of Object.entries(props)) {
      // Sanitize property names for Neo4j
      const cleanKey = key.replace(/[^a-zA-Z0-9_]/g, '_');
      formatted[cleanKey] = value;
    }
    return formatted;
  }

  private buildProps(props: any): string {
    if (!props || Object.keys(props).length === 0) return '';
    
    const propStrings = Object.entries(props).map(([key, value]) => {
      const formattedValue = typeof value === 'string' 
        ? `'${value.replace(/'/g, "\\'")}'` 
        : value;
      return `\`${key}\`: ${formattedValue}`;
    });
    
    return `{ ${propStrings.join(', ')} }`;
  }

  private formatRecord(record: any): any {
    const obj = {};
    for (const key of record.keys) {
      obj[key] = record.get(key);
    }
    return obj;
  }
}