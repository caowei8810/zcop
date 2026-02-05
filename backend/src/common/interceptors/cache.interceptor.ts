import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap, map } from 'rxjs/operators';
import { Redis } from 'ioredis';

@Injectable()
export class CacheInterceptor implements NestInterceptor {
  private readonly logger = new Logger(CacheInterceptor.name);
  private readonly redis: Redis;

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD,
      lazyConnect: true,
    });
  }

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const key = this.generateCacheKey(context, request);
    
    // Only cache GET requests
    if (request.method !== 'GET') {
      return next.handle();
    }

    try {
      // Try to get from cache
      const cached = await this.redis.get(key);
      if (cached) {
        this.logger.log(`Cache HIT: ${key}`);
        return of(JSON.parse(cached));
      }
    } catch (error) {
      this.logger.error(`Cache GET error: ${error.message}`);
    }

    // Not in cache, proceed with handler
    return next.handle().pipe(
      tap(async (data) => {
        try {
          // Store in cache with default TTL of 1 hour
          const ttl = this.getTtl(context);
          await this.redis.setex(key, ttl, JSON.stringify(data));
          this.logger.log(`Cache SET: ${key} (TTL: ${ttl}s)`);
        } catch (error) {
          this.logger.error(`Cache SET error: ${error.message}`);
        }
      })
    );
  }

  private generateCacheKey(context: ExecutionContext, request: any): string {
    const controller = context.getClass().name;
    const handler = context.getHandler().name;
    const url = request.url;
    const userId = request.user?.id || 'anonymous';
    
    // Include query parameters in the key
    const queryParams = new URLSearchParams(request.query).toString();
    
    return `cache:${controller}:${handler}:${userId}:${url}?${queryParams}`;
  }

  private getTtl(context: ExecutionContext): number {
    // Get custom TTL from decorator if available, otherwise default to 1 hour
    const customTtl = Reflect.getMetadata('cache_ttl', context.getHandler());
    return customTtl || 3600; // Default 1 hour
  }
}

// Decorator to set custom cache TTL
export const CacheTTL = (seconds: number) => {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata('cache_ttl', seconds, descriptor.value);
  };
};