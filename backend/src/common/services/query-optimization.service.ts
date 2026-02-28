import { Injectable } from '@nestjs/common';
import { Neo4jService } from 'nest-neo4j';

@Injectable()
export class QueryOptimizationService {
  constructor(private neo4jService: Neo4jService) {}

  async analyzeQueryPerformance(cypher: string, params: Record<string, any> = {}): Promise<any> {
    // In a real implementation, this would use Neo4j's built-in profiling
    // For now, we'll return mock performance data
    const startTime = Date.now();
    try {
      const result = await this.neo4jService.read(cypher, params);
      const duration = Date.now() - startTime;
      
      // Determine if query is slow
      const isSlow = duration > 1000; // More than 1 second is considered slow
      
      return {
        duration,
        isSlow,
        resultCount: result.records.length,
        recommendations: this.getRecommendations(cypher, duration),
        indexes: await this.getSuggestedIndexes(cypher),
      };
    } catch (error) {
      return {
        error: error.message,
        duration: Date.now() - startTime,
      };
    }
  }

  async optimizeQuery(cypher: string, params: Record<string, any> = {}): Promise<{ optimizedCypher: string; performanceGain: number }> {
    // This would implement actual query optimization logic
    // For now, return the original query with mock optimization
    const originalPerformance = await this.analyzeQueryPerformance(cypher, params);
    
    // Apply basic optimizations
    let optimizedCypher = cypher;
    
    // Remove unnecessary spaces and normalize
    optimizedCypher = optimizedCypher.replace(/\s+/g, ' ').trim();
    
    // Add basic index hints if needed (simplified logic)
    if (cypher.toLowerCase().includes('where')) {
      // Add index hint suggestion
      optimizedCypher = optimizedCypher.replace(
        /MATCH\s+\(([^)]+)\)\s+WHERE/gi,
        'MATCH ($1) USING INDEX '
      );
    }
    
    const optimizedPerformance = await this.analyzeQueryPerformance(optimizedCypher, params);
    
    const originalDuration = originalPerformance.duration || 0;
    const optimizedDuration = optimizedPerformance.duration || 0;
    
    const performanceGain = originalDuration > 0 
      ? ((originalDuration - optimizedDuration) / originalDuration) * 100 
      : 0;
    
    return {
      optimizedCypher,
      performanceGain: Math.max(0, performanceGain), // Ensure non-negative
    };
  }

  async getSuggestedIndexes(cypher: string): Promise<any[]> {
    // Analyze query to suggest indexes
    const suggestedIndexes = [];
    
    // Look for patterns that suggest indexes
    if (cypher.toLowerCase().match(/where.*\.id\s*=/)) {
      suggestedIndexes.push({
        type: 'node_property',
        label: this.extractLabelFromCypher(cypher),
        property: 'id',
        statement: `CREATE INDEX FOR (n:\`${this.extractLabelFromCypher(cypher)}\`) ON (n.id)`,
        estimatedImprovement: 'high',
      });
    }
    
    if (cypher.toLowerCase().match(/where.*\.name\s*=/)) {
      suggestedIndexes.push({
        type: 'node_property',
        label: this.extractLabelFromCypher(cypher),
        property: 'name',
        statement: `CREATE INDEX FOR (n:\`${this.extractLabelFromCypher(cypher)}\`) ON (n.name)`,
        estimatedImprovement: 'medium',
      });
    }
    
    return suggestedIndexes;
  }

  async getQueryPlan(cypher: string): Promise<any> {
    // In a real implementation, this would call Neo4j's EXPLAIN/PROFILE
    // For now, return mock plan data
    return {
      operator: 'Mock Query Plan',
      arguments: { cypher },
      identifiers: this.extractIdentifiers(cypher),
      planner: 'mock_planner',
      runtime: 'mock_runtime',
      indexes: [],
      version: 'mock_version',
      format: 'mock_format',
    };
  }

  private getRecommendations(cypher: string, duration: number): string[] {
    const recommendations = [];
    
    if (duration > 5000) {
      recommendations.push('Query taking more than 5 seconds - consider adding indexes');
    }
    
    if (cypher.toLowerCase().includes('return *')) {
      recommendations.push('Avoid RETURN * for better performance - specify needed fields');
    }
    
    if ((cypher.match(/match/gi)?.length || 0) > 3) {
      recommendations.push('Multiple MATCH clauses - consider using WITH to break down complex queries');
    }
    
    if (cypher.toLowerCase().includes('limit')) {
      recommendations.push('LIMIT clause present - ensure proper ordering if results need to be predictable');
    }
    
    return recommendations;
  }

  private extractLabelFromCypher(cypher: string): string {
    const match = cypher.match(/MATCH\s+\([^)]*:`([^`]*)`?\s*\)/i);
    return match ? match[1] : 'Unknown';
  }

  private extractIdentifiers(cypher: string): string[] {
    const identifiers = new Set<string>();
    // Extract variable names from MATCH clauses
    const matches = cypher.match(/MATCH\s+\(\s*([a-zA-Z_][a-zA-Z0-9_]*)/gi);
    if (matches) {
      matches.forEach(match => {
        const varName = match.split('(')[1].trim();
        identifiers.add(varName);
      });
    }
    return Array.from(identifiers);
  }
}