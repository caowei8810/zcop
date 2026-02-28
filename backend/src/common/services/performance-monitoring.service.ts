import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppService } from './app.service';
import { AuditLog } from '../common/entities/audit-log.entity';

@Injectable()
export class PerformanceMonitoringService {
  private readonly logger = Logger;
  
  constructor(
    @InjectRepository(AppService)
    private readonly appRepository: Repository<AppService>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  /**
   * Measures execution time of a given function
   */
  async measureExecutionTime<T>(fn: () => Promise<T>, operationName: string): Promise<{ result: T, executionTime: number }> {
    const startTime = performance.now();
    const result = await fn();
    const endTime = performance.now();
    const executionTime = endTime - startTime;

    this.logger.log(`${operationName} executed in ${executionTime.toFixed(2)} milliseconds`);

    return { result, executionTime };
  }

  /**
   * Monitors memory usage
   */
  getMemoryUsage(): NodeJS.MemoryUsage {
    const memoryUsage = process.memoryUsage();
    this.logger.log(`Memory Usage - RSS: ${Math.round(memoryUsage.rss / 1024 / 1024)} MB`);
    return memoryUsage;
  }

  /**
   * Monitors CPU usage
   */
  getCpuUsage(): { user: number; system: number } {
    const startUsage = process.cpuUsage();
    // Small delay to get meaningful measurement
    const now = Date.now();
    while (Date.now() - now < 100);
    const endUsage = process.cpuUsage(startUsage);
    
    this.logger.log(`CPU Usage - User: ${endUsage.user / 1000}ms, System: ${endUsage.system / 1000}ms`);
    return endUsage;
  }

  /**
   * Runs a performance benchmark test
   */
  async runBenchmark(testName: string, iterations: number, testFunction: () => Promise<any>): Promise<any> {
    const results = [];
    let totalTime = 0;

    this.logger.log(`Starting benchmark: ${testName} with ${iterations} iterations`);

    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      await testFunction();
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      totalTime += executionTime;
      results.push(executionTime);
    }

    const averageTime = totalTime / iterations;
    const minTime = Math.min(...results);
    const maxTime = Math.max(...results);

    this.logger.log(`Benchmark Results for ${testName}:`);
    this.logger.log(`  Average execution time: ${averageTime.toFixed(2)} ms`);
    this.logger.log(`  Min execution time: ${minTime.toFixed(2)} ms`);
    this.logger.log(`  Max execution time: ${maxTime.toFixed(2)} ms`);
    this.logger.log(`  Total execution time: ${totalTime.toFixed(2)} ms`);

    // Store benchmark results in audit log for historical tracking
    await this.auditLogRepository.save({
      userId: 'SYSTEM',
      action: `BENCHMARK_${testName.toUpperCase()}`,
      resource: 'PERFORMANCE_MONITORING',
      timestamp: new Date(),
      success: true,
      details: JSON.stringify({
        iterations,
        averageTime: parseFloat(averageTime.toFixed(2)),
        minTime: parseFloat(minTime.toFixed(2)),
        maxTime: parseFloat(maxTime.toFixed(2)),
        totalTime: parseFloat(totalTime.toFixed(2))
      })
    });

    return {
      testName,
      iterations,
      averageTime,
      minTime,
      maxTime,
      totalTime,
      results
    };
  }

  /**
   * Checks system health with performance metrics
   */
  async getPerformanceMetrics(): Promise<any> {
    const memoryUsage = this.getMemoryUsage();
    const cpuUsage = this.getCpuUsage();
    
    const healthStatus = await this.performDetailedHealthCheck();
    
    return {
      timestamp: new Date().toISOString(),
      memory: {
        rss: Math.round(memoryUsage.rss / 1024 / 1024), // MB
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
        external: Math.round(memoryUsage.external / 1024 / 1024), // MB
      },
      cpu: {
        user: cpuUsage.user / 1000, // ms
        system: cpuUsage.system / 1000, // ms
      },
      health: healthStatus
    };
  }

  /**
   * Performs detailed health checks with performance metrics
   */
  private async performDetailedHealthCheck(): Promise<any> {
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      checks: {
        database: await this.measureExecutionTime(
          () => this.checkDatabaseConnection(), 
          'Database Connection Check'
        ),
        cache: await this.measureExecutionTime(
          () => this.checkCacheConnection(), 
          'Cache Connection Check'
        ),
        storage: await this.measureExecutionTime(
          () => this.checkStorageAvailability(), 
          'Storage Availability Check'
        ),
      },
    };
    return healthStatus;
  }

  private async checkDatabaseConnection(): Promise<boolean> {
    try {
      // Implement database connectivity check
      return true;
    } catch (error) {
      this.logger.error(`Database connection failed: ${error.message}`);
      return false;
    }
  }

  private async checkCacheConnection(): Promise<boolean> {
    try {
      // Implement cache connectivity check
      return true;
    } catch (error) {
      this.logger.error(`Cache connection failed: ${error.message}`);
      return false;
    }
  }

  private async checkStorageAvailability(): Promise<boolean> {
    try {
      // Implement storage availability check
      return true;
    } catch (error) {
      this.logger.error(`Storage availability check failed: ${error.message}`);
      return false;
    }
  }
}