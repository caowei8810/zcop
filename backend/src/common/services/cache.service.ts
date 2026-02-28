import { Injectable } from '@nestjs/common';
import { RedisService } from '@liaoliaots/nestjs-redis';
import { Client } from 'redis';

@Injectable()
export class CacheService {
  private redisClient: Client;

  constructor(private redisService: RedisService) {
    this.redisClient = this.redisService.getClient();
  }

  async get<T>(key: string): Promise<T | null> {
    const value = await this.redisClient.get(key);
    if (value === null) return null;
    
    try {
      return JSON.parse(value);
    } catch {
      return value as any;
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<boolean> {
    try {
      const serializedValue = typeof value === 'string' ? value : JSON.stringify(value);
      if (ttl) {
        await this.redisClient.setex(key, ttl, serializedValue);
      } else {
        await this.redisClient.set(key, serializedValue);
      }
      return true;
    } catch {
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    try {
      await this.redisClient.del(key);
      return true;
    } catch {
      return false;
    }
  }

  async has(key: string): Promise<boolean> {
    const exists = await this.redisClient.exists(key);
    return exists === 1;
  }

  async clear(pattern: string): Promise<number> {
    const keys = await this.redisClient.keys(pattern);
    if (keys.length > 0) {
      await this.redisClient.del(...keys);
    }
    return keys.length;
  }

  async getOrSet<T>(
    key: string, 
    factory: () => Promise<T>, 
    ttl?: number
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    await this.set(key, value, ttl);
    return value;
  }

  async increment(key: string, amount: number = 1): Promise<number> {
    return await this.redisClient.incrby(key, amount);
  }

  async decrement(key: string, amount: number = 1): Promise<number> {
    return await this.redisClient.decrby(key, amount);
  }

  async expire(key: string, seconds: number): Promise<boolean> {
    const result = await this.redisClient.expire(key, seconds);
    return result === 1;
  }

  async ttl(key: string): Promise<number> {
    return await this.redisClient.ttl(key);
  }

  async keys(pattern: string): Promise<string[]> {
    return await this.redisClient.keys(pattern);
  }

  async flushAll(): Promise<void> {
    await this.redisClient.flushall();
  }
}