import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Neo4jService } from 'nest-neo4j';
import { RedisService } from '@liaoliaots/nestjs-redis';
import { Client } from 'redis';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    @InjectDataSource() private dataSource: DataSource,
    private neo4jService: Neo4jService,
    private redisService: RedisService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Comprehensive health check endpoint' })
  async healthCheck() {
    const startTime = Date.now();
    
    // Check PostgreSQL connectivity
    let postgresOk = false;
    let postgresLatency: number | null = null;
    try {
      const postgresStart = Date.now();
      await this.dataSource.query('SELECT 1');
      postgresOk = true;
      postgresLatency = Date.now() - postgresStart;
    } catch (error) {
      postgresOk = false;
    }

    // Check Neo4j connectivity
    let neo4jOk = false;
    let neo4jLatency: number | null = null;
    try {
      const neo4jStart = Date.now();
      await this.neo4jService.read(`RETURN 'connected' AS status`);
      neo4jOk = true;
      neo4jLatency = Date.now() - neo4jStart;
    } catch (error) {
      neo4jOk = false;
    }

    // Check Redis connectivity
    let redisOk = false;
    let redisLatency: number | null = null;
    try {
      const redisStart = Date.now();
      const client: Client = this.redisService.getClient();
      await client.ping();
      redisOk = true;
      redisLatency = Date.now() - redisStart;
    } catch (error) {
      redisOk = false;
    }

    const overallOk = postgresOk && neo4jOk && redisOk;
    const totalLatency = Date.now() - startTime;

    return {
      status: overallOk ? 'OK' : 'ERROR',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      totalLatency: `${totalLatency}ms`,
      message: overallOk 
        ? 'ZCOP Platform is running smoothly' 
        : 'One or more services are experiencing issues',
      services: {
        postgres: {
          status: postgresOk ? 'UP' : 'DOWN',
          latency: postgresLatency ? `${postgresLatency}ms` : null,
        },
        neo4j: {
          status: neo4jOk ? 'UP' : 'DOWN',
          latency: neo4jLatency ? `${neo4jLatency}ms` : null,
        },
        redis: {
          status: redisOk ? 'UP' : 'DOWN',
          latency: redisLatency ? `${redisLatency}ms` : null,
        },
      },
      checks: {
        totalLatency: `${totalLatency}ms`,
        timestamp: new Date().toISOString(),
      },
    };
  }

  @Get('liveness')
  @ApiOperation({ summary: 'Liveness probe for container orchestration' })
  liveness() {
    return { status: 'alive', timestamp: new Date().toISOString() };
  }

  @Get('readiness')
  @ApiOperation({ summary: 'Readiness probe for container orchestration' })
  async readiness() {
    // Check if all critical services are ready
    const isReady = await this.isPlatformReady();
    
    return {
      status: isReady ? 'ready' : 'not ready',
      timestamp: new Date().toISOString(),
      readyServices: {
        postgres: await this.isPostgresReady(),
        neo4j: await this.isNeo4jReady(),
        redis: await this.isRedisReady(),
      }
    };
  }

  private async isPlatformReady(): Promise<boolean> {
    const checks = await Promise.all([
      this.isPostgresReady(),
      this.isNeo4jReady(),
      this.isRedisReady(),
    ]);
    return checks.every(check => check);
  }

  private async isPostgresReady(): Promise<boolean> {
    try {
      await this.dataSource.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  private async isNeo4jReady(): Promise<boolean> {
    try {
      await this.neo4jService.read(`RETURN 'ready' AS status`);
      return true;
    } catch {
      return false;
    }
  }

  private async isRedisReady(): Promise<boolean> {
    try {
      const client: Client = this.redisService.getClient();
      await client.ping();
      return true;
    } catch {
      return false;
    }
  }
}