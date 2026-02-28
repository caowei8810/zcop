import { Injectable, OnModuleInit, Inject, CACHE_MANAGER } from '@nestjs/common';
import { QdrantClient } from '@qdrant/js-client-rest';
import { ConfigService } from '@nestjs/config';
import { Cache } from 'cache-manager';

@Injectable()
export class QdrantService implements OnModuleInit {
  private client: QdrantClient;

  constructor(
    private configService: ConfigService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {
    this.client = new QdrantClient({
      host: this.configService.get<string>('QDRANT_HOST') || 'localhost',
      port: this.configService.get<number>('QDRANT_PORT') || 6334,
      apiKey: this.configService.get<string>('QDRANT_API_KEY'),
    });
  }

  async onModuleInit() {
    // Initialize the connection and ensure required collections exist
    await this.ensureCollections();
  }

  private async ensureCollections() {
    // Define collections for different types of embeddings
    const collections = [
      {
        name: 'ontology_embeddings',
        vectors: {
          size: 1536, // Standard OpenAI embedding size, adjustable
          distance: 'Cosine',
        },
        hnsw_config: {
          ef_construct: 100,
          m: 16,
        },
        optimizers_config: {
          vacuum_min_vector_number: 1000,
        },
      },
      {
        name: 'knowledge_graph_embeddings',
        vectors: {
          size: 1536,
          distance: 'Cosine',
        },
      },
      {
        name: 'business_rules_embeddings',
        vectors: {
          size: 1536,
          distance: 'Cosine',
        },
      },
    ];

    for (const collection of collections) {
      try {
        await this.client.getCollection(collection.name);
        console.log(`Collection ${collection.name} already exists`);
      } catch (error) {
        // Collection doesn't exist, create it
        await this.client.createCollection(collection.name, {
          vectors: collection.vectors,
          hnsw_config: collection.hnsw_config,
          optimizers_config: collection.optimizers_config,
        });
        console.log(`Created collection: ${collection.name}`);
      }
    }
  }

  async createEmbedding(text: string, model?: string): Promise<number[]> {
    // First check if embedding is in cache
    const cacheKey = `embedding:${text.substring(0, 50)}:${text.length}`;
    const cachedEmbedding = await this.cacheManager.get<number[]>(cacheKey);
    
    if (cachedEmbedding) {
      return cachedEmbedding;
    }

    // In a real implementation, this would call an embedding API
    // For now, we'll simulate the creation of an embedding
    // This is a placeholder - in production, connect to actual embedding service
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    
    // Simple hash-based embedding for demonstration
    const embedding = [];
    for (let i = 0; i < 1536; i++) {
      const index = i % data.length;
      embedding.push(Math.sin(data[index] * (i + 1)));
    }
    
    // Normalize the embedding
    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    const normalizedEmbedding = embedding.map(val => val / norm || 0);
    
    // Cache the embedding for future use
    await this.cacheManager.set(cacheKey, normalizedEmbedding, 3600); // Cache for 1 hour
    
    return normalizedEmbedding;
  }

  async storeEmbedding(
    collectionName: string,
    id: string,
    vector: number[],
    payload: Record<string, any>
  ): Promise<void> {
    // Clear any related cache entries
    const cachePattern = `${collectionName}:${id}:*`;
    // Note: We're not clearing pattern-based cache entries since cache-manager doesn't support it natively
    // In a production system, we'd implement this differently
    
    await this.client.upsert(collectionName, {
      points: [
        {
          id,
          vector,
          payload,
        },
      ],
    });
  }

  async searchEmbeddings(
    collectionName: string,
    queryVector: number[],
    limit: number = 10,
    filter?: Record<string, any>
  ): Promise<any[]> {
    // Create cache key based on query parameters
    const filterStr = filter ? JSON.stringify(filter) : '';
    const cacheKey = `search:${collectionName}:${queryVector.slice(0, 5).join(',')}:${limit}:${filterStr}`;
    
    const cachedResults = await this.cacheManager.get<any[]>(cacheKey);
    if (cachedResults) {
      return cachedResults;
    }

    const searchParams: any = {
      vector: queryVector,
      limit,
      with_payload: true,
      with_vectors: false,
    };

    if (filter) {
      searchParams.filter = this.buildFilter(filter);
    }

    const results = await this.client.search(collectionName, searchParams);
    const processedResults = results.map(result => ({
      id: result.id,
      score: result.score,
      payload: result.payload,
    }));

    // Cache the results
    await this.cacheManager.set(cacheKey, processedResults, 300); // Cache for 5 minutes
    
    return processedResults;
  }

  async deleteEmbedding(collectionName: string, id: string | string[]): Promise<void> {
    const ids = Array.isArray(id) ? id : [id];
    await this.client.delete(collectionName, {
      points: ids,
    });
  }

  async getEmbedding(collectionName: string, id: string): Promise<any> {
    const cacheKey = `get:${collectionName}:${id}`;
    const cachedResult = await this.cacheManager.get<any>(cacheKey);
    
    if (cachedResult) {
      return cachedResult;
    }

    const records = await this.client.retrieve(collectionName, {
      ids: [id],
      with_payload: true,
      with_vectors: true,
    });

    if (records.length === 0) {
      return null;
    }

    const record = records[0];
    const result = {
      id: record.id,
      vector: record.vector,
      payload: record.payload,
    };

    // Cache the result
    await this.cacheManager.set(cacheKey, result, 600); // Cache for 10 minutes
    
    return result;
  }

  async updateEmbedding(
    collectionName: string,
    id: string,
    vector?: number[],
    payload?: Record<string, any>
  ): Promise<void> {
    // Clear cache entry for this item
    const cacheKey = `get:${collectionName}:${id}`;
    await this.cacheManager.del(cacheKey);

    const updateParams: any = { id };

    if (vector) {
      updateParams.vector = vector;
    }

    if (payload) {
      updateParams.payload = payload;
    }

    await this.client.updatePoint(collectionName, updateParams);
  }

  async createBatchEmbeddings(
    collectionName: string,
    texts: string[],
    payloads: Record<string, any>[]
  ): Promise<void> {
    const points = [];
    
    for (let i = 0; i < texts.length; i++) {
      const vector = await this.createEmbedding(texts[i]);
      points.push({
        id: `emb_${Date.now()}_${i}`,
        vector,
        payload: payloads[i],
      });
    }

    await this.client.upsert(collectionName, {
      points,
    });
  }

  async semanticSearch(
    collectionName: string,
    query: string,
    limit: number = 10,
    filter?: Record<string, any>
  ): Promise<any[]> {
    const queryVector = await this.createEmbedding(query);
    return this.searchEmbeddings(collectionName, queryVector, limit, filter);
  }

  async findSimilarEntities(
    collectionName: string,
    entityId: string,
    limit: number = 10
  ): Promise<any[]> {
    const entity = await this.getEmbedding(collectionName, entityId);
    if (!entity) {
      throw new Error(`Entity with id ${entityId} not found`);
    }

    return this.searchEmbeddings(collectionName, entity.vector, limit, { excludeId: entityId });
  }

  private buildFilter(filter: Record<string, any>): any {
    const conditions = [];
    
    for (const [key, value] of Object.entries(filter)) {
      if (key === 'excludeId') {
        conditions.push({
          must_not: [{
            key: 'id',
            match: { value }
          }]
        });
      } else {
        if (Array.isArray(value)) {
          conditions.push({
            is_empty: {
              key: key
            }
          });
        } else {
          conditions.push({
            key: key,
            match: { value }
          });
        }
      }
    }

    return conditions.length > 0 ? { must: conditions } : undefined;
  }

  async getCollectionStats(collectionName: string): Promise<any> {
    const cacheKey = `stats:${collectionName}`;
    const cachedStats = await this.cacheManager.get<any>(cacheKey);
    
    if (cachedStats) {
      return cachedStats;
    }

    const collectionInfo = await this.client.getCollection(collectionName);
    const stats = {
      name: collectionName,
      vectorCount: collectionInfo.points_count,
      segmentsCount: collectionInfo.segments_count,
      config: collectionInfo.config,
    };

    // Cache for 10 minutes
    await this.cacheManager.set(cacheKey, stats, 600);
    
    return stats;
  }

  async clearCollection(collectionName: string): Promise<void> {
    // Clear all cache entries related to this collection
    // Note: Actual cache manager implementations may require different approaches
    // depending on the store used (Redis, memory, etc.)
    
    const collectionInfo = await this.client.getCollection(collectionName);
    if (collectionInfo.points_count > 0) {
      // Get all point IDs and delete them
      const scrollResult = await this.client.scroll(collectionName, {
        limit: 1000,
        with_payload: false,
        with_vectors: false,
      });

      const ids = scrollResult.points.map(point => point.id);
      if (ids.length > 0) {
        await this.client.delete(collectionName, { points: ids });
      }
    }
  }
}