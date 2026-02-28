import { Injectable, Logger, Inject, CACHE_MANAGER } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cache } from 'cache-manager';
import { Request, Response } from 'express';
import { Observable, from, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

export interface ApiEndpointConfig {
  id: string;
  path: string;
  method: string;
  rateLimit: {
    points: number;
    duration: number;
  };
  cacheTtl: number; // seconds
  timeout: number; // milliseconds
  circuitBreaker?: {
    threshold: number;
    resetTimeout: number;
  };
  upstream: string;
}

export interface CircuitBreakerState {
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failureCount: number;
  lastFailure: number;
  nextAttempt: number;
}

@Injectable()
export class ApiGatewayOptimizationService {
  private readonly logger = new Logger(ApiGatewayOptimizationService.name);
  private endpointConfigs: Map<string, ApiEndpointConfig> = new Map();
  private circuitBreakerStates: Map<string, CircuitBreakerState> = new Map();
  private rateLimiters: Map<string, any> = new Map(); // In a real implementation, use rate-limiter-flexible

  constructor(
    private configService: ConfigService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {
    this.initializeDefaultEndpoints();
  }

  private initializeDefaultEndpoints() {
    // Define optimized configurations for common endpoints
    const defaultEndpoints: ApiEndpointConfig[] = [
      {
        id: 'health-check',
        path: '/api/health',
        method: 'GET',
        rateLimit: { points: 100, duration: 60 },
        cacheTtl: 30, // 30 seconds
        timeout: 5000,
        upstream: 'backend:3000',
      },
      {
        id: 'graphql',
        path: '/graphql',
        method: 'POST',
        rateLimit: { points: 50, duration: 60 },
        cacheTtl: 0, // No cache for mutations
        timeout: 30000,
        circuitBreaker: {
          threshold: 5,
          resetTimeout: 60000, // 1 minute
        },
        upstream: 'backend:3000',
      },
      {
        id: 'data-governance',
        path: '/api/governance/*',
        method: 'GET',
        rateLimit: { points: 20, duration: 60 },
        cacheTtl: 300, // 5 minutes
        timeout: 15000,
        circuitBreaker: {
          threshold: 3,
          resetTimeout: 120000, // 2 minutes
        },
        upstream: 'backend:3000',
      },
      {
        id: 'authentication',
        path: '/api/auth/*',
        method: 'POST',
        rateLimit: { points: 5, duration: 60 }, // Strict rate limiting for auth
        cacheTtl: 0,
        timeout: 10000,
        circuitBreaker: {
          threshold: 2,
          resetTimeout: 300000, // 5 minutes
        },
        upstream: 'backend:3000',
      },
    ];

    defaultEndpoints.forEach(endpoint => {
      this.endpointConfigs.set(endpoint.id, endpoint);
      this.initializeRateLimiter(endpoint);
    });
  }

  private initializeRateLimiter(endpoint: ApiEndpointConfig) {
    // In a real implementation, we would use rate-limiter-flexible
    // For now, we'll simulate it
    this.rateLimiters.set(endpoint.id, {
      consume: async (key: string) => {
        const rateLimitKey = `rate_limit:${endpoint.id}:${key}`;
        const current = await this.cacheManager.get<number>(rateLimitKey) || 0;
        
        if (current >= endpoint.rateLimit.points) {
          throw new Error('Rate limit exceeded');
        }
        
        await this.cacheManager.set(rateLimitKey, current + 1, endpoint.rateLimit.duration);
      }
    });
  }

  async routeRequest(req: Request, res: Response): Promise<void> {
    const path = req.path;
    const method = req.method.toUpperCase();
    
    // Find matching endpoint configuration
    const endpointConfig = this.findMatchingEndpoint(path, method);
    if (!endpointConfig) {
      res.status(404).json({ error: 'Endpoint not found' });
      return;
    }

    // Check circuit breaker state
    if (endpointConfig.circuitBreaker && this.isCircuitOpen(endpointConfig.id)) {
      res.status(503).json({ error: 'Service temporarily unavailable' });
      return;
    }

    // Apply rate limiting
    try {
      const clientIp = this.getClientIP(req);
      const rateLimiter = this.rateLimiters.get(endpointConfig.id);
      await rateLimiter.consume(clientIp);
    } catch (error) {
      if (error.message === 'Rate limit exceeded') {
        res.status(429).json({ error: 'Rate limit exceeded' });
        return;
      }
      throw error;
    }

    // Check cache for GET requests
    if (method === 'GET' && endpointConfig.cacheTtl > 0) {
      const cacheKey = `api_cache:${endpointConfig.id}:${path}`;
      const cachedResponse = await this.cacheManager.get(cacheKey);
      
      if (cachedResponse) {
        this.logger.log(`Cache hit for ${path}`);
        res.set('X-Cache', 'HIT');
        res.json(cachedResponse);
        return;
      }
    }

    // Process request with timeout
    try {
      const result = await this.proxyRequest(req, endpointConfig, endpointConfig.timeout);
      
      // Cache GET responses
      if (method === 'GET' && endpointConfig.cacheTtl > 0) {
        const cacheKey = `api_cache:${endpointConfig.id}:${path}`;
        await this.cacheManager.set(cacheKey, result, endpointConfig.cacheTtl);
        this.logger.log(`Cached response for ${path}`);
      }
      
      // Close circuit if it was open
      if (endpointConfig.circuitBreaker) {
        this.closeCircuit(endpointConfig.id);
      }
      
      res.set('X-Cache', 'MISS');
      res.json(result);
    } catch (error) {
      // Open circuit on failure if configured
      if (endpointConfig.circuitBreaker) {
        this.openCircuit(endpointConfig.id);
      }
      
      this.logger.error(`Request failed for ${path}: ${error.message}`);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private findMatchingEndpoint(path: string, method: string): ApiEndpointConfig | undefined {
    // Find the most specific matching endpoint
    for (const [_, endpoint] of this.endpointConfigs) {
      if (endpoint.method === method) {
        if (endpoint.path === path) {
          return endpoint;
        }
        // Check for wildcard matches
        if (endpoint.path.endsWith('*')) {
          const basePath = endpoint.path.slice(0, -1);
          if (path.startsWith(basePath)) {
            return endpoint;
          }
        }
      }
    }
    return undefined;
  }

  private isCircuitOpen(endpointId: string): boolean {
    const state = this.circuitBreakerStates.get(endpointId);
    if (!state) {
      return false;
    }

    if (state.state === 'CLOSED') {
      return false;
    }

    if (state.state === 'OPEN') {
      // Check if reset timeout has passed
      if (Date.now() >= state.nextAttempt) {
        this.halfOpenCircuit(endpointId);
        return false; // Circuit is now half-open, allow one request
      }
      return true;
    }

    // HALF_OPEN state - only one request allowed
    return false;
  }

  private openCircuit(endpointId: string): void {
    const config = this.endpointConfigs.get(endpointId)?.circuitBreaker;
    if (!config) return;

    this.circuitBreakerStates.set(endpointId, {
      state: 'OPEN',
      failureCount: 0,
      lastFailure: Date.now(),
      nextAttempt: Date.now() + config.resetTimeout,
    });

    this.logger.warn(`Circuit opened for endpoint: ${endpointId}`);
  }

  private closeCircuit(endpointId: string): void {
    this.circuitBreakerStates.set(endpointId, {
      state: 'CLOSED',
      failureCount: 0,
      lastFailure: 0,
      nextAttempt: 0,
    });

    this.logger.log(`Circuit closed for endpoint: ${endpointId}`);
  }

  private halfOpenCircuit(endpointId: string): void {
    this.circuitBreakerStates.set(endpointId, {
      state: 'HALF_OPEN',
      failureCount: 0,
      lastFailure: Date.now(),
      nextAttempt: 0,
    });

    this.logger.log(`Circuit half-opened for endpoint: ${endpointId}`);
  }

  private getClientIP(req: Request): string {
    return req.ip ||
      req.headers['x-forwarded-for'] as string ||
      req.headers['x-real-ip'] as string ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      (req.connection as any).remoteAddress;
  }

  private async proxyRequest(req: Request, endpointConfig: ApiEndpointConfig, timeout: number): Promise<any> {
    // Simulate proxying to upstream service
    // In a real implementation, this would make an HTTP request to the upstream service
    return new Promise((resolve, reject) => {
      // Simulate network delay
      const delay = Math.floor(Math.random() * 100) + 50; // 50-150ms
      
      setTimeout(() => {
        // Simulate success or failure based on endpoint configuration
        if (Math.random() > 0.95) { // 5% failure rate simulation
          reject(new Error('Simulated upstream failure'));
        } else {
          resolve({
            message: 'Success',
            upstream: endpointConfig.upstream,
            path: req.path,
            method: req.method,
            timestamp: new Date().toISOString(),
          });
        }
      }, Math.min(delay, timeout));
    });
  }

  /**
   * Get performance metrics for API gateway
   */
  async getPerformanceMetrics() {
    const metrics = {
      totalRequests: 0,
      cachedRequests: 0,
      rateLimitedRequests: 0,
      circuitBreakerTrips: 0,
      avgResponseTime: 0,
      endpoints: Array.from(this.endpointConfigs.values()).map(config => ({
        id: config.id,
        path: config.path,
        method: config.method,
        rateLimit: config.rateLimit,
        cacheTtl: config.cacheTtl,
        circuitBreaker: config.circuitBreaker,
      }))
    };

    return metrics;
  }

  /**
   * Update endpoint configuration dynamically
   */
  async updateEndpointConfig(id: string, config: Partial<ApiEndpointConfig>) {
    const existing = this.endpointConfigs.get(id);
    if (!existing) {
      throw new Error(`Endpoint with id ${id} not found`);
    }

    this.endpointConfigs.set(id, { ...existing, ...config });
    this.logger.log(`Updated endpoint configuration: ${id}`);
  }
}