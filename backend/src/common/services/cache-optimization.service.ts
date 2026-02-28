import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

@Injectable()
export class CacheOptimizationService {
  private readonly logger = new Logger(CacheOptimizationService.name);
  private redis: Redis;

  constructor(private configService: ConfigService) {
    this.redis = new Redis({
      host: this.configService.get<string>('REDIS_HOST') || 'localhost',
      port: this.configService.get<number>('REDIS_PORT') || 6379,
      password: this.configService.get<string>('REDIS_PASSWORD'),
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
  }

  /**
   * Implements a tiered caching strategy
   * Tier 1: Hot data (frequently accessed, short TTL)
   * Tier 2: Warm data (moderately accessed, medium TTL)
   * Tier 3: Cold data (infrequently accessed, long TTL)
   */
  async getWithTieredCache<T>(
    key: string,
    fetchFn: () => Promise<T>,
    options: {
      hotTTL?: number;    // Default 5 minutes
      warmTTL?: number;   // Default 1 hour
      coldTTL?: number;   // Default 24 hours
      fallbackOnError?: boolean;
    } = {}
  ): Promise<T> {
    const { hotTTL = 300, warmTTL = 3600, coldTTL = 86400, fallbackOnError = true } = options;
    
    try {
      // Try to get from hot cache first
      let cached = await this.redis.get(`hot:${key}`);
      if (cached) {
        this.logger.debug(`Hot cache hit for key: ${key}`);
        return JSON.parse(cached);
      }

      // Try warm cache
      cached = await this.redis.get(`warm:${key}`);
      if (cached) {
        this.logger.debug(`Warm cache hit for key: ${key}`);
        // Promote to hot cache
        await this.redis.setex(`hot:${key}`, hotTTL, cached);
        return JSON.parse(cached);
      }

      // Try cold cache
      cached = await this.redis.get(`cold:${key}`);
      if (cached) {
        this.logger.debug(`Cold cache hit for key: ${key}`);
        // Promote to warm cache
        await this.redis.setex(`warm:${key}`, warmTTL, cached);
        return JSON.parse(cached);
      }

      // Cache miss - fetch data
      this.logger.debug(`Cache miss for key: ${key}, fetching from source`);
      const result = await fetchFn();

      // Determine cache tier based on data characteristics
      const serializedResult = JSON.stringify(result);
      const dataSize = Buffer.byteLength(serializedResult);
      
      if (dataSize < 1024) { // Less than 1KB - hot data
        await this.redis.setex(`hot:${key}`, hotTTL, serializedResult);
        this.logger.debug(`Stored in hot cache: ${key}`);
      } else if (dataSize < 10240) { // Less than 10KB - warm data
        await this.redis.setex(`warm:${key}`, warmTTL, serializedResult);
        this.logger.debug(`Stored in warm cache: ${key}`);
      } else { // Large data - cold cache
        await this.redis.setex(`cold:${key}`, coldTTL, serializedResult);
        this.logger.debug(`Stored in cold cache: ${key}`);
      }

      return result;
    } catch (error) {
      this.logger.error(`Cache operation failed for key: ${key}`, error);
      
      if (fallbackOnError) {
        // If cache fails, still return data from source
        return await fetchFn();
      }
      
      throw error;
    }
  }

  /**
   * Implements cache warming for frequently accessed data
   */
  async warmCache(keysAndFetchers: Array<{key: string, fetchFn: () => Promise<any>}>, ttl: number = 3600) {
    const promises = keysAndFetchers.map(async ({key, fetchFn}) => {
      try {
        const data = await fetchFn();
        const serializedData = JSON.stringify(data);
        await this.redis.setex(`warm:${key}`, ttl, serializedData);
        this.logger.debug(`Warmed cache for key: ${key}`);
      } catch (error) {
        this.logger.error(`Failed to warm cache for key: ${key}`, error);
      }
    });

    await Promise.all(promises);
  }

  /**
   * Implements cache invalidation strategies
   */
  async invalidateCache(key: string) {
    // Invalidate all tiers for this key
    await Promise.all([
      this.redis.del(`hot:${key}`),
      this.redis.del(`warm:${key}`),
      this.redis.del(`cold:${key}`)
    ]);
    
    this.logger.debug(`Invalidated cache for key: ${key}`);
  }

  /**
   * Implements cache warming based on access patterns
   */
  async getWithTracking<T>(key: string, fetchFn: () => Promise<T>): Promise<T> {
    // Track access for cache warming decisions
    const accessKey = `access:${key}`;
    const currentCount = parseInt(await this.redis.get(accessKey) || '0');
    await this.redis.setex(accessKey, 86400, (currentCount + 1).toString()); // 24hr expiry

    // Get with tiered cache
    const result = await this.getWithTieredCache(key, fetchFn);

    // If accessed more than 5 times in 24hrs, promote to hot cache with longer TTL
    if (currentCount + 1 > 5) {
      const serializedResult = JSON.stringify(result);
      await this.redis.setex(`hot:${key}`, 3600, serializedResult); // 1hr in hot cache
    }

    return result;
  }

  /**
   * Cleanup method
   */
  async onModuleDestroy() {
    await this.redis.quit();
  }
}