import { Injectable } from '@nestjs/common';
import { Neo4jService } from 'nest-neo4j';

@Injectable()
export class GraphAnalyticsService {
  constructor(private neo4jService: Neo4jService) {}

  async getGraphStatistics(): Promise<any> {
    // Get basic graph statistics
    const nodeCountResult = await this.neo4jService.read(
      'MATCH (n) RETURN count(n) AS nodeCount',
      {}
    );
    const relCountResult = await this.neo4jService.read(
      'MATCH ()-[r]->() RETURN count(r) AS relCount',
      {}
    );
    
    const labelCountsResult = await this.neo4jService.read(
      'MATCH (n) RETURN labels(n) AS labels, count(n) AS count',
      {}
    );
    
    const relTypeCountsResult = await this.neo4jService.read(
      'MATCH ()-[r]->() RETURN type(r) AS type, count(r) AS count',
      {}
    );
    
    return {
      nodes: nodeCountResult.records[0]?.get('nodeCount') || 0,
      relationships: relCountResult.records[0]?.get('relCount') || 0,
      labelCounts: labelCountsResult.records.map(record => ({
        labels: record.get('labels'),
        count: record.get('count'),
      })),
      relationshipTypeCounts: relTypeCountsResult.records.map(record => ({
        type: record.get('type'),
        count: record.get('count'),
      })),
    };
  }

  async getCentralityMetrics(nodeLabel: string): Promise<any> {
    // Calculate centrality metrics for nodes of a given label
    // Using degree centrality as an example
    
    const inDegreeResult = await this.neo4jService.read(`
      MATCH (n:\`${nodeLabel}\`)
      OPTIONAL MATCH (m)-[]->(n)
      RETURN n, count(m) AS inDegree
      ORDER BY inDegree DESC
      LIMIT 10
    `, {});
    
    const outDegreeResult = await this.neo4jService.read(`
      MATCH (n:\`${nodeLabel}\`)
      OPTIONAL MATCH (n)-[]->(m)
      RETURN n, count(m) AS outDegree
      ORDER BY outDegree DESC
      LIMIT 10
    `, {});
    
    return {
      highestInDegree: inDegreeResult.records.map(record => ({
        node: record.get('n'),
        inDegree: record.get('inDegree'),
      })),
      highestOutDegree: outDegreeResult.records.map(record => ({
        node: record.get('n'),
        outDegree: record.get('outDegree'),
      })),
    };
  }

  async findShortestPath(startNodeId: string, endNodeId: string): Promise<any> {
    // Find shortest path between two nodes
    const result = await this.neo4jService.read(`
      MATCH (start), (end)
      WHERE id(start) = $startId AND id(end) = $endId
      CALL algo.shortestPath.stream(start, end, null)
      YIELD nodeId, cost
      MATCH (n) WHERE id(n) = nodeId
      RETURN n, cost
      ORDER BY cost
    `, {
      startId: parseInt(startNodeId),
      endId: parseInt(endNodeId),
    });
    
    // Note: This requires the APOC library or Graph Algorithms plugin
    // For now, return a mock response
    return {
      path: [],
      distance: 0,
      found: false,
    };
  }

  async detectCommunities(nodeLabel: string, relationshipType: string): Promise<any> {
    // Detect communities using weakly connected components
    const result = await this.neo4jService.read(`
      MATCH (n:\`${nodeLabel}\`)-[:\`${relationshipType}\`]-(m:\`${nodeLabel}\`)
      CALL algo.wcc.stream(n, m)
      YIELD nodeId, componentId
      RETURN componentId, collect(nodeId) AS communityNodes
      ORDER BY size(communityNodes) DESC
    `, {});
    
    // Note: This requires the Graph Algorithms plugin
    // For now, return a mock response
    return {
      communities: [],
      totalCommunities: 0,
    };
  }

  async findSimilarNodes(targetNodeId: string, limit: number = 5): Promise<any> {
    // Find nodes similar to a target node based on shared relationships
    const result = await this.neo4jService.read(`
      MATCH (target) WHERE id(target) = $targetId
      MATCH (target)-[r]-(shared)
      MATCH (similar)-[r2]-(shared)
      WHERE NOT similar = target
      RETURN similar, count(shared) AS similarityScore
      ORDER BY similarityScore DESC
      LIMIT $limit
    `, {
      targetId: parseInt(targetNodeId),
      limit,
    });
    
    return result.records.map(record => ({
      node: record.get('similar'),
      similarityScore: record.get('similarityScore'),
    }));
  }

  async getConnectedComponents(): Promise<any> {
    // Get connected components in the graph
    const result = await this.neo4jService.read(`
      CALL algo.connectedComponents.stream()
      YIELD nodeId, componentId
      RETURN componentId, count(nodeId) AS componentSize
      ORDER BY componentSize DESC
    `, {});
    
    // Note: This requires the Graph Algorithms plugin
    // For now, return a mock response
    return {
      components: [],
      largestComponent: 0,
      totalComponents: 0,
    };
  }

  async calculateGraphDensity(): Promise<number> {
    // Calculate graph density = (edges) / (nodes * (nodes - 1))
    const stats = await this.getGraphStatistics();
    
    if (stats.nodes <= 1) {
      return 0;
    }
    
    const maxPossibleEdges = stats.nodes * (stats.nodes - 1);
    return maxPossibleEdges > 0 ? stats.relationships / maxPossibleEdges : 0;
  }

  async findMostConnectedNodes(limit: number = 10): Promise<any[]> {
    // Find nodes with the highest degree (connections)
    const result = await this.neo4jService.read(`
      MATCH (n)
      OPTIONAL MATCH (n)-->()
      WITH n, count(*) as outDegree
      OPTIONAL MATCH ()-->(n)
      WITH n, outDegree, count(*) as inDegree
      RETURN n, (outDegree + inDegree) AS totalDegree
      ORDER BY totalDegree DESC
      LIMIT $limit
    `, {
      limit,
    });
    
    return result.records.map(record => ({
      node: record.get('n'),
      totalDegree: record.get('totalDegree'),
      outDegree: record.get('outDegree'),
      inDegree: record.get('inDegree'),
    }));
  }
}