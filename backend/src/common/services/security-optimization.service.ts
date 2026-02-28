import { Injectable, Logger, CanActivate, ExecutionContext } from '@nestjs/common';
import { Observable } from 'rxjs';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import { Redis } from 'ioredis';

export enum SecurityConstraint {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface SecurityOptions {
  constraint: SecurityConstraint;
  rateLimit?: {
    points: number;
    duration: number;
  };
  allowFrom?: string[];
  denyFrom?: string[];
  requireMfa?: boolean;
  requireIpWhitelist?: boolean;
  maxSessionAge?: number;
}

@Injectable()
export class SecurityOptimizationService {
  private readonly logger = new Logger(SecurityOptimizationService.name);
  private rateLimiters: Map<SecurityConstraint, RateLimiterRedis> = new Map();
  private redis: Redis;

  constructor(
    private reflector: Reflector,
    private configService: ConfigService,
  ) {
    this.initializeRateLimiters();
    this.setupRedisConnection();
  }

  private setupRedisConnection() {
    this.redis = new Redis({
      host: this.configService.get<string>('REDIS_HOST') || 'localhost',
      port: this.configService.get<number>('REDIS_PORT') || 6379,
      password: this.configService.get<string>('REDIS_PASSWORD'),
      lazyConnect: true,
    });
  }

  private initializeRateLimiters() {
    const redisClient = this.redis;
    
    // Different rate limits based on security constraints
    this.rateLimiters.set(SecurityConstraint.LOW, new RateLimiterRedis({
      storeClient: redisClient,
      keyPrefix: 'rate_limit_low',
      points: 100, // Number of points
      duration: 60, // Per 60 seconds
    }));

    this.rateLimiters.set(SecurityConstraint.MEDIUM, new RateLimiterRedis({
      storeClient: redisClient,
      keyPrefix: 'rate_limit_medium',
      points: 50, // Number of points
      duration: 60, // Per 60 seconds
    }));

    this.rateLimiters.set(SecurityConstraint.HIGH, new RateLimiterRedis({
      storeClient: redisClient,
      keyPrefix: 'rate_limit_high',
      points: 20, // Number of points
      duration: 60, // Per 60 seconds
    }));

    this.rateLimiters.set(SecurityConstraint.CRITICAL, new RateLimiterRedis({
      storeClient: redisClient,
      keyPrefix: 'rate_limit_critical',
      points: 5, // Number of points
      duration: 60, // Per 60 seconds
    }));
  }

  async checkSecurityConstraints(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.getAllAndOverride<SecurityOptions>('security', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!options) {
      return true; // No security constraints defined, allow access
    }

    const request = context.switchToHttp().getRequest<Request>();
    const ip = this.getClientIP(request);
    const userAgent = request.headers['user-agent'];

    // Check IP-based restrictions
    if (options.allowFrom && !this.isIpAllowed(ip, options.allowFrom)) {
      this.logger.warn(`Access denied from IP ${ip} for endpoint requiring allowFrom`);
      return false;
    }

    if (options.denyFrom && this.isIpDenied(ip, options.denyFrom)) {
      this.logger.warn(`Access denied from IP ${ip} for endpoint in denyFrom`);
      return false;
    }

    // Apply rate limiting based on security constraint
    const rateLimiter = this.rateLimiters.get(options.constraint);
    if (rateLimiter) {
      try {
        await rateLimiter.consume(ip);
      } catch (rejRes) {
        this.logger.warn(`Rate limit exceeded for IP ${ip} on ${request.path}`);
        throw new Error('Rate limit exceeded');
      }
    }

    // Additional security checks based on constraint level
    switch (options.constraint) {
      case SecurityConstraint.HIGH:
      case SecurityConstraint.CRITICAL:
        // For high/critical endpoints, verify additional factors
        if (options.requireMfa && !this.hasValidMfa(request)) {
          this.logger.warn(`MFA required but not provided for critical endpoint ${request.path}`);
          return false;
        }
        
        if (options.requireIpWhitelist && !this.isIpWhitelisted(ip)) {
          this.logger.warn(`IP not whitelisted for critical endpoint ${request.path}`);
          return false;
        }

        // Check session age for critical operations
        if (options.maxSessionAge && !this.isSessionFresh(request, options.maxSessionAge)) {
          this.logger.warn(`Session too old for critical endpoint ${request.path}`);
          return false;
        }
        break;
    }

    // Log security event
    this.logger.log({
      message: 'Security check passed',
      ip,
      userAgent,
      endpoint: request.path,
      constraint: options.constraint,
      timestamp: new Date().toISOString(),
    });

    return true;
  }

  private getClientIP(request: Request): string {
    // Get the real IP address considering proxies
    return request.ip ||
      request.headers['x-forwarded-for'] as string ||
      request.headers['x-real-ip'] as string ||
      request.connection.remoteAddress ||
      request.socket.remoteAddress ||
      (request.connection as any).remoteAddress;
  }

  private isIpAllowed(clientIp: string, allowedIps: string[]): boolean {
    return allowedIps.some(allowedIp => {
      if (allowedIp.includes('/')) {
        // CIDR notation
        return this.isIpInCidrRange(clientIp, allowedIp);
      }
      return clientIp === allowedIp || clientIp.replace(/^::ffff:/, '') === allowedIp;
    });
  }

  private isIpDenied(clientIp: string, deniedIps: string[]): boolean {
    return deniedIps.some(deniedIp => {
      if (deniedIp.includes('/')) {
        // CIDR notation
        return this.isIpInCidrRange(clientIp, deniedIp);
      }
      return clientIp === deniedIp || clientIp.replace(/^::ffff:/, '') === deniedIp;
    });
  }

  private isIpInCidrRange(ip: string, cidr: string): boolean {
    // Simplified CIDR checking (would require a proper library in production)
    const [range, prefixLength] = cidr.split('/');
    const mask = ~((1 << (32 - parseInt(prefixLength))) - 1);
    
    // This is a simplified implementation
    // In production, use a proper library like 'ip-cidr' or 'cidr-tools'
    return ip.startsWith(range.replace(/\.\d+$/, ''));
  }

  private hasValidMfa(request: Request): boolean {
    // Check for MFA token in headers or session
    const mfaToken = request.headers['x-mfa-token'] as string;
    if (!mfaToken) {
      return false;
    }

    // In a real implementation, verify the MFA token
    // This would typically involve checking against a stored challenge or using TOTP verification
    return this.verifyMfaToken(mfaToken);
  }

  private verifyMfaToken(token: string): boolean {
    // Placeholder for MFA token verification
    // In production, integrate with your MFA provider
    return token.length === 6 && /^\d+$/.test(token);
  }

  private isIpWhitelisted(ip: string): boolean {
    // Check if IP is in the configured whitelist
    const whitelist = this.configService.get<string[]>('SECURITY_IP_WHITELIST') || [];
    return this.isIpAllowed(ip, whitelist);
  }

  private isSessionFresh(request: Request, maxAgeSeconds: number): boolean {
    // Check if session is fresh enough for critical operations
    const sessionCreatedAt = request.session?.createdAt as number;
    if (!sessionCreatedAt) {
      return false;
    }

    const ageSeconds = (Date.now() - sessionCreatedAt) / 1000;
    return ageSeconds < maxAgeSeconds;
  }

  /**
   * Method to apply security constraints to a route handler
   */
  applySecurityConstraints(options: SecurityOptions) {
    return (target: any, propertyName: string, descriptor: PropertyDescriptor) => {
      this.reflector.set('security', options, descriptor.value);
      return descriptor;
    };
  }

  async onModuleDestroy() {
    if (this.redis) {
      await this.redis.quit();
    }
  }
}

/**
 * Guard that uses the security optimization service
 */
@Injectable()
export class SecurityGuard implements CanActivate {
  constructor(
    private securityService: SecurityOptimizationService,
    private reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): Observable<boolean> | Promise<boolean> | boolean {
    return this.securityService.checkSecurityConstraints(context);
  }
}