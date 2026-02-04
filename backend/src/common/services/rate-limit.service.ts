import { Injectable } from '@nestjs/common';
import { RateLimiterRedis } from 'rate-limiter-flexible';

@Injectable()
export class RateLimitService {
  private rateLimiter: RateLimiterRedis;

  constructor() {
    // Initialize rate limiter with Redis
    this.rateLimiter = new RateLimiterRedis({
      storeClient: require('redis').createClient({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6379,
      }),
      keyPrefix: 'middleware',
      points: 10, // Number of points
      duration: 60, // Per 60 seconds by IP
    });
  }

  async consume(identifier: string) {
    try {
      return await this.rateLimiter.consume(identifier);
    } catch (rejRes) {
      // Rejection response
      return rejRes;
    }
  }
}