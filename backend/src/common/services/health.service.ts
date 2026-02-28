import { Injectable } from '@nestjs/common';
import {
  HealthCheckService,
  HttpHealthIndicator,
  TypeOrmHealthIndicator,
  RedisHealthIndicator,
  HealthCheckResult,
  HealthCheckError,
  HealthIndicatorResult,
} from '@nestjs/terminus';

@Injectable()
export class HealthService {
  constructor(
    private health: HealthCheckService,
    private http: HttpHealthIndicator,
    private db: TypeOrmHealthIndicator,
    private redis: RedisHealthIndicator,
  ) {}

  async check(): Promise<HealthCheckResult> {
    try {
      const result = await this.health.check([
        // Database check
        () => this.db.pingCheck('database'),
        
        // Redis check
        () => this.redis.pingCheck('redis'),
        
        // Memory check
        () => {
          const used = process.memoryUsage().heap_used / 1024 / 1024;
          const total = process.memoryUsage().heap_total / 1024 / 1024;
          const usage = (used / total) * 100;
          
          if (usage > 90) {
            throw new Error('Memory usage above 90%');
          }
          
          return { memory: { status: 'up', heap_used: Math.round(used), heap_total: Math.round(total) } };
        },
        
        // Uptime check
        () => {
          const uptime = process.uptime();
          if (uptime < 10) {
            throw new Error('Service just started');
          }
          return { uptime: { status: 'up', seconds: Math.round(uptime) } };
        },
      ]);
      
      return result;
    } catch (error) {
      if (error instanceof HealthCheckError) {
        throw error;
      }
      throw new HealthCheckError('Health check failed', {
        system: { status: 'down', error: error.message },
      });
    }
  }

  async checkDatabase(): Promise<HealthIndicatorResult> {
    try {
      return await this.db.pingCheck('database');
    } catch (error) {
      return { database: { status: 'down', error: error.message } };
    }
  }

  async checkRedis(): Promise<HealthIndicatorResult> {
    try {
      return await this.redis.pingCheck('redis');
    } catch (error) {
      return { redis: { status: 'down', error: error.message } };
    }
  }

  async checkMemory(): Promise<HealthIndicatorResult> {
    const used = process.memoryUsage().heap_used / 1024 / 1024;
    const total = process.memoryUsage().heap_total / 1024 / 1024;
    const usage = (used / total) * 100;
    
    return {
      memory: {
        status: usage > 90 ? 'down' : 'up',
        heap_used: Math.round(used),
        heap_total: Math.round(total),
        usage_percent: Math.round(usage * 100) / 100,
      },
    };
  }

  async getDetailedStatus(): Promise<any> {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.version,
      platform: process.platform,
      memory: {
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
        heap_total: Math.round(process.memoryUsage().heap_total / 1024 / 1024),
        heap_used: Math.round(process.memoryUsage().heap_used / 1024 / 1024),
        external: Math.round(process.memoryUsage().external / 1024 / 1024),
      },
      cpu: {
        user: process.cpuUsage().user,
        system: process.cpuUsage().system,
      },
    };
  }
}