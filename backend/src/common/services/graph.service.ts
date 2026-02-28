import { Injectable } from '@nestjs/common';
import { Neo4jService } from 'nest-neo4j';

@Injectable()
export class GraphService {
  constructor(private neo4jService: Neo4jService) {}

  async createNode(labels: string[], properties: Record<string, any>): Promise<any> {
    const labelsStr = labels.map(label => `\`${label}\``).join(':');
    const props = this.buildProps(properties);
    
    const cypher = `CREATE (n:${labelsStr} ${props}) RETURN n`;
    const result = await this.neo4jService.write(cypher, {});
    
    return result.records.map(record => record.get('n'));
  }

  async findNodes(label: string, conditions: Record<string, any> = {}): Promise<any[]> {
    const conditionStr = this.buildCondition(conditions);
    const cypher = `MATCH (n:\`${label}\`${conditionStr}) RETURN n`;
    const result = await this.neo4jService.read(cypher, {});
    
    return result.records.map(record => record.get('n'));
  }

  async updateNode(label: string, conditions: Record<string, any>, updates: Record<string, any>): Promise<number> {
    const conditionStr = this.buildCondition(conditions);
    const updateStr = this.buildUpdateClause(updates);
    
    const cypher = `MATCH (n:\`${label}\`${conditionStr}) ${updateStr} RETURN count(n)`;
    const result = await this.neo4jService.write(cypher, {});
    
    return result.records[0]?.get('count(n)') || 0;
  }

  async deleteNode(label: string, conditions: Record<string, any> = {}): Promise<number> {
    const conditionStr = this.buildCondition(conditions);
    const cypher = `MATCH (n:\`${label}\`${conditionStr}) DELETE n RETURN count(n)`;
    const result = await this.neo4jService.write(cypher, {});
    
    return result.records[0]?.get('count(n)') || 0;
  }

  async createRelationship(
    fromLabel: string, 
    fromConditions: Record<string, any>,
    toLabel: string, 
    toConditions: Record<string, any>, 
    relType: string,
    properties: Record<string, any> = {}
  ): Promise<any> {
    const fromConditionStr = this.buildCondition(fromConditions);
    const toConditionStr = this.buildCondition(toConditions);
    const props = this.buildProps(properties);
    
    const cypher = `
      MATCH (from:\`${fromLabel}\`${fromConditionStr}), (to:\`${toLabel}\`${toConditionStr})
      CREATE (from)-[r:\`${relType}\`${props}]->(to)
      RETURN r
    `;
    const result = await this.neo4jService.write(cypher, {});
    
    return result.records.map(record => record.get('r'));
  }

  async findRelationships(
    fromLabel: string, 
    relType: string, 
    toLabel: string,
    fromConditions: Record<string, any> = {},
    toConditions: Record<string, any> = {}
  ): Promise<any[]> {
    const fromConditionStr = this.buildCondition(fromConditions);
    const toConditionStr = this.buildCondition(toConditions);
    
    const cypher = `
      MATCH (from:\`${fromLabel}\`${fromConditionStr})-[r:\`${relType}\`]->(to:\`${toLabel}\`${toConditionStr})
      RETURN r, from, to
    `;
    const result = await this.neo4jService.read(cypher, {});
    
    return result.records.map(record => ({
      relationship: record.get('r'),
      from: record.get('from'),
      to: record.get('to'),
    }));
  }

  async executeCustomCypher(cypher: string, params: Record<string, any> = {}): Promise<any[]> {
    const result = await this.neo4jService.read(cypher, params);
    return result.records.map(record => record.toObject());
  }

  private buildProps(props: Record<string, any>): string {
    if (!props || Object.keys(props).length === 0) return '';
    
    const propStrings = Object.entries(props).map(([key, value]) => {
      const formattedValue = typeof value === 'string' ? `'${value.replace(/'/g, "\\'")}'` : value;
      return `${key}: ${formattedValue}`;
    });
    
    return `{ ${propStrings.join(', ')} }`;
  }

  private buildCondition(conditions: Record<string, any>): string {
    if (!conditions || Object.keys(conditions).length === 0) return '';
    
    const conditionStrings = Object.entries(conditions).map(([key, value]) => {
      const formattedValue = typeof value === 'string' ? `'${value.replace(/'/g, "\\'")}'` : value;
      return `.${key} = ${formattedValue}`;
    });
    
    return ` { ${conditionStrings.join(', ')} }`;
  }

  private buildUpdateClause(updates: Record<string, any>): string {
    if (!updates || Object.keys(updates).length === 0) return '';
    
    const updateStrings = Object.entries(updates).map(([key, value]) => {
      const formattedValue = typeof value === 'string' ? `'${value.replace(/'/g, "\\'")}'` : value;
      return `SET n.${key} = ${formattedValue}`;
    });
    
    return updateStrings.join(' ');
  }
}