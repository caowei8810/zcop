import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import { Logger } from '@nestjs/common';

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RateLimitMiddleware.name);
  private readonly rateLimiter: RateLimiterRedis;

  constructor() {
    this.rateLimiter = new RateLimiterRedis({
      storeClient: require('ioredis').createClient({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD,
      }),
      keyPrefix: 'middleware',
      points: parseInt(process.env.RATE_LIMIT_POINTS) || 100, // Number of points
      duration: parseInt(process.env.RATE_LIMIT_DURATION) || 60, // Per 60 seconds
      blockDuration: 300, // Block for 5 minutes if consumed more than points in duration
    });
  }

  async use(req: Request, res: Response, next: NextFunction) {
    // Skip rate limiting for internal requests or specific paths
    if (this.shouldSkipRateLimiting(req)) {
      return next();
    }

    // Get identifier for rate limiting (IP + user ID if authenticated)
    const identifier = this.getIdentifier(req);

    try {
      await this.rateLimiter.consume(identifier);
      next();
    } catch (rejRes) {
      this.logger.warn(`Rate limit exceeded for ${identifier}`, {
        ip: req.ip,
        userId: req.user?.id || 'anonymous',
        identifier,
      });

      // Set rate limit headers
      res.set({
        'Retry-After': Math.round(rejRes.msBeforeNext / 1000),
        'X-RateLimit-Limit': rejRes.limitedAt,
        'X-RateLimit-Remaining': rejRes.consumedPoints,
        'X-RateLimit-Reset': new Date(Date.now() + rejRes.msBeforeNext).toISOString(),
      });

      res.status(429).json({
        statusCode: 429,
        timestamp: new Date().toISOString(),
        path: req.url,
        error: 'Too Many Requests',
        message: 'Rate limit exceeded, please try again later',
        retryAfter: Math.round(rejRes.msBeforeNext / 1000),
      });
    }
  }

  private getIdentifier(req: Request): string {
    const ip = this.getClientIp(req);
    const userId = req.user?.id || 'anonymous';
    return `${ip}_${userId}`;
  }

  private getClientIp(req: Request): string {
    return (
      req.headers['x-forwarded-for'] ||
      req.headers['x-real-ip'] ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
      'unknown'
    );
  }

  private shouldSkipRateLimiting(req: Request): boolean {
    // Skip for internal health checks
    if (req.path === '/api/health' || req.path === '/health') {
      return true;
    }

    // Skip for specific internal paths
    if (req.path.startsWith('/api/internal')) {
      return true;
    }

    return false;
  }
}