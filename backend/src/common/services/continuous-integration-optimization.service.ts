import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ContinuousIntegrationOptimizationConfig {
  enabled: boolean;
  maxBuildConcurrency: number;
  buildTimeout: number;          // in seconds
  artifactRetention: number;     // in days
  cacheEnabled: boolean;
  cacheRetention: number;        // in days
  parallelPipelineExecution: boolean;
  pipelineTimeout: number;       // in seconds
  notificationEnabled: boolean;
  autoDeployEnabled: boolean;
  rollbackEnabled: boolean;
  testCoverageThreshold: number; // percentage
  securityScanEnabled: boolean;
  performanceBaseline: number;   // performance threshold
  resourceLimits: {
    cpu: number;                // CPU limit in millicores
    memory: number;             // Memory limit in MB
  };
}

export interface BuildArtifact {
  id: string;
  name: string;
  version: string;
  path: string;
  size: number;                // in bytes
  checksum: string;
  createdAt: number;
  expiresAt: number;
  tags: string[];
  metadata: Record<string, any>;
}

export interface PipelineJob {
  id: string;
  name: string;
  stage: 'build' | 'test' | 'security' | 'deploy' | 'rollback';
  status: 'pending' | 'running' | 'success' | 'failed' | 'cancelled';
  startedAt: number;
  finishedAt?: number;
  duration?: number;
  artifacts: BuildArtifact[];
  logs: string[];
  error?: string;
  dependencies: string[];       // other job IDs this job depends on
  timeout: number;             // in seconds
  resources: {
    cpu: number;               // millicores used
    memory: number;            // MB used
  };
}

export interface DeploymentConfig {
  environment: string;
  branch: string;
  autoApprove: boolean;
  rollbackOnFailure: boolean;
  healthCheckUrl: string;
  deploymentStrategy: 'blue-green' | 'rolling' | 'canary' | 'recreate';
}

@Injectable()
export class ContinuousIntegrationOptimizationService {
  private readonly logger = new Logger(ContinuousIntegrationOptimizationService.name);
  private config: ContinuousIntegrationOptimizationConfig;
  private pipelineJobs: Map<string, PipelineJob> = new Map();
  private buildArtifacts: Map<string, BuildArtifact> = new Map();
  private activeBuilds: Set<string> = new Set();
  private buildQueue: string[] = [];
  private artifactCache: Map<string, any> = new Map();
  private timer: NodeJS.Timeout | null = null;

  constructor(private configService: ConfigService) {
    this.config = {
      enabled: this.configService.get<boolean>('CI_ENABLED') ?? true,
      maxBuildConcurrency: this.configService.get<number>('CI_MAX_CONCURRENCY') || 3,
      buildTimeout: this.configService.get<number>('CI_BUILD_TIMEOUT') || 600, // 10 minutes
      artifactRetention: this.configService.get<number>('CI_ARTIFACT_RETENTION') || 30, // 30 days
      cacheEnabled: this.configService.get<boolean>('CI_CACHE_ENABLED') ?? true,
      cacheRetention: this.configService.get<number>('CI_CACHE_RETENTION') || 7, // 7 days
      parallelPipelineExecution: this.configService.get<boolean>('CI_PARALLEL_EXECUTION') ?? true,
      pipelineTimeout: this.configService.get<number>('CI_PIPELINE_TIMEOUT') || 1800, // 30 minutes
      notificationEnabled: this.configService.get<boolean>('CI_NOTIFICATIONS_ENABLED') ?? true,
      autoDeployEnabled: this.configService.get<boolean>('CI_AUTO_DEPLOY') ?? true,
      rollbackEnabled: this.configService.get<boolean>('CI_ROLLBACK_ENABLED') ?? true,
      testCoverageThreshold: this.configService.get<number>('CI_TEST_COVERAGE_THRESHOLD') || 80, // 80%
      securityScanEnabled: this.configService.get<boolean>('CI_SECURITY_SCAN') ?? true,
      performanceBaseline: this.configService.get<number>('CI_PERFORMANCE_BASELINE') || 1000, // 1 second
      resourceLimits: {
        cpu: this.configService.get<number>('CI_RESOURCE_CPU') || 1000, // 1 CPU core
        memory: this.configService.get<number>('CI_RESOURCE_MEMORY') || 2048, // 2GB
      },
    };

    // Start cleanup timers
    this.startCleanupTimers();
  }

  /**
   * Start cleanup timers for artifacts and cache
   */
  private startCleanupTimers(): void {
    // Cleanup artifacts every hour
    setInterval(() => {
      this.cleanupExpiredArtifacts();
    }, 60 * 60 * 1000);

    // Cleanup cache every 30 minutes
    setInterval(() => {
      this.cleanupExpiredCache();
    }, 30 * 60 * 1000);

    this.logger.log('Started CI/CD cleanup timers');
  }

  /**
   * Trigger a new build pipeline
   */
  async triggerBuild(
    branch: string, 
    commitHash: string, 
    config?: Partial<DeploymentConfig>
  ): Promise<PipelineJob> {
    if (!this.config.enabled) {
      throw new Error('CI/CD is disabled');
    }

    // Create a build job
    const jobId = this.generateId();
    const job: PipelineJob = {
      id: jobId,
      name: `build-${branch}-${commitHash.substring(0, 8)}`,
      stage: 'build',
      status: 'pending',
      startedAt: Date.now(),
      artifacts: [],
      logs: [`Build triggered for branch ${branch}, commit ${commitHash}`],
      dependencies: [],
      timeout: this.config.buildTimeout,
      resources: {
        cpu: 0,
        memory: 0,
      },
    };

    this.pipelineJobs.set(jobId, job);
    this.addToBuildQueue(jobId);

    this.logger.log(`Triggered build: ${job.name} (ID: ${jobId})`);

    // Process the build queue
    await this.processBuildQueue();

    return job;
  }

  /**
   * Add a job to the build queue
   */
  private addToBuildQueue(jobId: string): void {
    if (!this.buildQueue.includes(jobId)) {
      this.buildQueue.push(jobId);
      this.logger.debug(`Added job ${jobId} to build queue (size: ${this.buildQueue.length})`);
    }
  }

  /**
   * Process the build queue
   */
  private async processBuildQueue(): Promise<void> {
    if (this.activeBuilds.size >= this.config.maxBuildConcurrency) {
      this.logger.debug(`Max concurrency reached (${this.activeBuilds.size}), waiting for builds to finish`);
      return;
    }

    while (this.buildQueue.length > 0 && this.activeBuilds.size < this.config.maxBuildConcurrency) {
      const jobId = this.buildQueue.shift();
      if (!jobId) continue;

      const job = this.pipelineJobs.get(jobId);
      if (!job) continue;

      // Mark as active
      this.activeBuilds.add(jobId);
      job.status = 'running';
      job.startedAt = Date.now();

      // Execute the pipeline
      this.executePipeline(job)
        .catch(error => {
          this.logger.error(`Pipeline execution failed for job ${jobId}: ${error.message}`);
          job.status = 'failed';
          job.error = error.message;
          job.finishedAt = Date.now();
          job.duration = job.finishedAt - job.startedAt;
        })
        .finally(() => {
          // Mark as inactive
          this.activeBuilds.delete(jobId);
          this.logger.log(`Build completed: ${job.name} (Status: ${job.status})`);
        });
    }
  }

  /**
   * Execute the complete pipeline
   */
  private async executePipeline(job: PipelineJob): Promise<void> {
    const stages: PipelineJob['stage'][] = ['build', 'test', 'security', 'deploy'];

    for (const stage of stages) {
      job.stage = stage;
      job.logs.push(`Starting stage: ${stage}`);

      let stageSuccess = false;
      
      switch (stage) {
        case 'build':
          stageSuccess = await this.executeBuildStage(job);
          break;
        case 'test':
          stageSuccess = await this.executeTestStage(job);
          break;
        case 'security':
          stageSuccess = await this.executeSecurityStage(job);
          break;
        case 'deploy':
          stageSuccess = await this.executeDeployStage(job);
          break;
      }

      if (!stageSuccess) {
        job.status = 'failed';
        job.logs.push(`Stage ${stage} failed`);
        break;
      }

      job.logs.push(`Stage ${stage} completed successfully`);
    }

    // Finalize job
    job.finishedAt = Date.now();
    job.duration = job.finishedAt - job.startedAt;
    
    if (job.status !== 'failed') {
      job.status = 'success';
    }

    // Send notification if enabled
    if (this.config.notificationEnabled) {
      await this.sendNotification(job);
    }
  }

  /**
   * Execute the build stage
   */
  private async executeBuildStage(job: PipelineJob): Promise<boolean> {
    try {
      // Simulate build process
      job.logs.push('Running build commands...');
      
      // Check for cached dependencies
      if (this.config.cacheEnabled) {
        const cacheHit = await this.restoreFromCache('dependencies');
        if (cacheHit) {
          job.logs.push('Restored dependencies from cache');
        } else {
          job.logs.push('Dependencies not in cache, installing...');
          // Simulate dependency installation
          await this.sleep(2000 + Math.random() * 3000);
          await this.storeToCache('dependencies', { installed: true, timestamp: Date.now() });
        }
      }

      // Simulate compilation/build
      await this.sleep(5000 + Math.random() * 5000);
      
      // Create build artifacts
      const artifact: BuildArtifact = {
        id: this.generateId(),
        name: `${job.name}-artifact`,
        version: '1.0.0',
        path: `/artifacts/${job.id}/${job.name}-artifact.zip`,
        size: 1024 * 1024 * 10, // 10MB
        checksum: this.generateChecksum(),
        createdAt: Date.now(),
        expiresAt: Date.now() + (this.config.artifactRetention * 24 * 60 * 60 * 1000),
        tags: ['build', job.id],
        metadata: { stage: 'build', jobId: job.id },
      };

      this.buildArtifacts.set(artifact.id, artifact);
      job.artifacts.push(artifact);

      job.logs.push(`Build completed, created artifact: ${artifact.name}`);
      return true;
    } catch (error) {
      job.error = error.message;
      job.logs.push(`Build failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Execute the test stage
   */
  private async executeTestStage(job: PipelineJob): Promise<boolean> {
    try {
      job.logs.push('Running tests...');
      
      // Simulate running tests
      await this.sleep(3000 + Math.random() * 4000);
      
      // Simulate test results
      const testCount = 100;
      const failingTests = Math.floor(Math.random() * 10); // 0-10 failing tests
      const coverage = 70 + Math.random() * 25; // 70-95% coverage
      
      job.logs.push(`Tests completed: ${testCount - failingTests}/${testCount} passed, ${coverage.toFixed(2)}% coverage`);
      
      // Check if test coverage meets threshold
      if (coverage < this.config.testCoverageThreshold) {
        job.error = `Test coverage ${coverage.toFixed(2)}% is below threshold of ${this.config.testCoverageThreshold}%`;
        job.logs.push(job.error);
        return false;
      }
      
      return true;
    } catch (error) {
      job.error = error.message;
      job.logs.push(`Test stage failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Execute the security stage
   */
  private async executeSecurityStage(job: PipelineJob): Promise<boolean> {
    if (!this.config.securityScanEnabled) {
      job.logs.push('Security scanning disabled, skipping stage');
      return true;
    }

    try {
      job.logs.push('Running security scans...');
      
      // Simulate security scanning
      await this.sleep(4000 + Math.random() * 6000);
      
      // Simulate security results
      const vulnerabilities = Math.floor(Math.random() * 5); // 0-4 vulnerabilities
      
      job.logs.push(`Security scan completed: ${vulnerabilities} vulnerabilities found`);
      
      // Fail if critical vulnerabilities found
      if (vulnerabilities > 2) {
        job.error = `Security scan failed: ${vulnerabilities} vulnerabilities found`;
        job.logs.push(job.error);
        return false;
      }
      
      return true;
    } catch (error) {
      job.error = error.message;
      job.logs.push(`Security stage failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Execute the deploy stage
   */
  private async executeDeployStage(job: PipelineJob): Promise<boolean> {
    if (!this.config.autoDeployEnabled) {
      job.logs.push('Auto-deployment disabled, skipping stage');
      return true;
    }

    try {
      job.logs.push('Starting deployment...');
      
      // Simulate deployment process
      await this.sleep(8000 + Math.random() * 7000);
      
      // Simulate health checks
      const healthCheckPassed = await this.performHealthCheck();
      
      if (!healthCheckPassed) {
        job.error = 'Health check failed after deployment';
        job.logs.push(job.error);
        return false;
      }
      
      job.logs.push('Deployment completed successfully');
      return true;
    } catch (error) {
      job.error = error.message;
      job.logs.push(`Deploy stage failed: ${error.message}`);
      
      // Attempt rollback if enabled
      if (this.config.rollbackEnabled) {
        job.logs.push('Attempting rollback...');
        await this.executeRollback(job);
      }
      
      return false;
    }
  }

  /**
   * Execute rollback
   */
  private async executeRollback(job: PipelineJob): Promise<boolean> {
    if (!this.config.rollbackEnabled) {
      job.logs.push('Rollback disabled');
      return false;
    }

    try {
      job.logs.push('Initiating rollback...');
      
      // Simulate rollback process
      await this.sleep(5000 + Math.random() * 5000);
      
      job.logs.push('Rollback completed');
      return true;
    } catch (error) {
      job.logs.push(`Rollback failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Perform health check
   */
  private async performHealthCheck(): Promise<boolean> {
    // Simulate health check
    return Math.random() > 0.1; // 90% success rate
  }

  /**
   * Restore from cache
   */
  private async restoreFromCache(key: string): Promise<boolean> {
    if (!this.config.cacheEnabled) {
      return false;
    }

    const cacheKey = `${key}_${this.getCurrentDateString()}`;
    return this.artifactCache.has(cacheKey);
  }

  /**
   * Store to cache
   */
  private async storeToCache(key: string, data: any): Promise<void> {
    if (!this.config.cacheEnabled) {
      return;
    }

    const cacheKey = `${key}_${this.getCurrentDateString()}`;
    this.artifactCache.set(cacheKey, data);
  }

  /**
   * Send notification about build result
   */
  private async sendNotification(job: PipelineJob): Promise<void> {
    const message = `Build ${job.name} ${job.status.toUpperCase()}: ${job.duration}ms`;
    this.logger.log(`[NOTIFICATION] ${message}`);
    
    // In a real implementation, this would send notifications via email, Slack, etc.
  }

  /**
   * Get a pipeline job by ID
   */
  getPipelineJob(jobId: string): PipelineJob | undefined {
    return this.pipelineJobs.get(jobId);
  }

  /**
   * Get build artifacts
   */
  getArtifacts(filter?: { jobId?: string; tag?: string }): BuildArtifact[] {
    let artifacts = Array.from(this.buildArtifacts.values());

    if (filter?.jobId) {
      artifacts = artifacts.filter(a => a.metadata.jobId === filter.jobId);
    }

    if (filter?.tag) {
      artifacts = artifacts.filter(a => a.tags.includes(filter.tag!));
    }

    return artifacts;
  }

  /**
   * Cancel a running job
   */
  cancelJob(jobId: string): boolean {
    const job = this.pipelineJobs.get(jobId);
    if (!job || job.status !== 'running') {
      return false;
    }

    job.status = 'cancelled';
    job.finishedAt = Date.now();
    job.duration = job.finishedAt - job.startedAt;
    
    // Remove from active builds
    this.activeBuilds.delete(jobId);
    
    // Remove from queue if it's still there
    const queueIndex = this.buildQueue.indexOf(jobId);
    if (queueIndex !== -1) {
      this.buildQueue.splice(queueIndex, 1);
    }

    this.logger.log(`Cancelled job: ${jobId}`);
    return true;
  }

  /**
   * Retry a failed job
   */
  async retryJob(jobId: string): Promise<PipelineJob | null> {
    const originalJob = this.pipelineJobs.get(jobId);
    if (!originalJob) {
      return null;
    }

    // Create a new job based on the original
    const newJobId = this.generateId();
    const newJob: PipelineJob = {
      ...originalJob,
      id: newJobId,
      status: 'pending',
      startedAt: Date.now(),
      finishedAt: undefined,
      duration: undefined,
      artifacts: [],
      logs: [`Retrying job based on original: ${jobId}`],
      error: undefined,
    };

    this.pipelineJobs.set(newJobId, newJob);
    this.addToBuildQueue(newJobId);

    // Process the build queue
    await this.processBuildQueue();

    return newJob;
  }

  /**
   * Cleanup expired artifacts
   */
  private cleanupExpiredArtifacts(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [id, artifact] of this.buildArtifacts.entries()) {
      if (now > artifact.expiresAt) {
        this.buildArtifacts.delete(id);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.log(`Cleaned up ${cleanedCount} expired artifacts`);
    }
  }

  /**
   * Cleanup expired cache
   */
  private cleanupExpiredCache(): void {
    if (!this.config.cacheEnabled) {
      return;
    }

    const retentionMs = this.config.cacheRetention * 24 * 60 * 60 * 1000;
    const cutoffDate = Date.now() - retentionMs;
    const cutoffDateString = new Date(cutoffDate).toISOString().split('T')[0];
    
    let cleanedCount = 0;
    for (const key of this.artifactCache.keys()) {
      // Keys are formatted as "name_dateString", so check if date portion is too old
      const parts = key.split('_');
      if (parts.length >= 2) {
        const datePart = parts[parts.length - 1]; // Last part should be date
        const date = new Date(datePart);
        if (date.getTime() < cutoffDate) {
          this.artifactCache.delete(key);
          cleanedCount++;
        }
      }
    }

    if (cleanedCount > 0) {
      this.logger.log(`Cleaned up ${cleanedCount} expired cache entries`);
    }
  }

  /**
   * Get CI/CD statistics
   */
  getCiStats(): {
    totalJobs: number;
    runningJobs: number;
    queuedJobs: number;
    successfulJobs: number;
    failedJobs: number;
    cancelledJobs: number;
    totalArtifacts: number;
    config: ContinuousIntegrationOptimizationConfig;
  } {
    let successfulJobs = 0;
    let failedJobs = 0;
    let cancelledJobs = 0;

    for (const job of this.pipelineJobs.values()) {
      switch (job.status) {
        case 'success': successfulJobs++; break;
        case 'failed': failedJobs++; break;
        case 'cancelled': cancelledJobs++; break;
      }
    }

    return {
      totalJobs: this.pipelineJobs.size,
      runningJobs: this.activeBuilds.size,
      queuedJobs: this.buildQueue.length,
      successfulJobs,
      failedJobs,
      cancelledJobs,
      totalArtifacts: this.buildArtifacts.size,
      config: this.config,
    };
  }

  /**
   * Get pipeline report
   */
  getPipelineReport(daysBack: number = 7): {
    summary: {
      totalPipelines: number;
      successRate: number;
      avgDuration: number;
      totalArtifacts: number;
    };
    byDay: Array<{
      date: string;
      total: number;
      successful: number;
      failed: number;
      avgDuration: number;
    }>;
    topFailingJobs: Array<{ jobId: string; failureCount: number; error: string }>;
  } {
    const since = Date.now() - (daysBack * 24 * 60 * 60 * 1000);
    const jobs = Array.from(this.pipelineJobs.values())
      .filter(j => j.startedAt >= since && j.finishedAt !== undefined);

    // Summary
    const successfulJobs = jobs.filter(j => j.status === 'success');
    const successRate = jobs.length > 0 ? (successfulJobs.length / jobs.length) * 100 : 0;
    const avgDuration = jobs.length > 0 
      ? jobs.reduce((sum, j) => sum + (j.duration || 0), 0) / jobs.length 
      : 0;

    // By day
    const dailyStats = new Map<string, {
      total: number;
      successful: number;
      failed: number;
      durations: number[];
    }>();

    for (const job of jobs) {
      const date = new Date(job.startedAt).toISOString().split('T')[0];
      if (!dailyStats.has(date)) {
        dailyStats.set(date, { total: 0, successful: 0, failed: 0, durations: [] });
      }

      const dayStat = dailyStats.get(date)!;
      dayStat.total++;
      if (job.status === 'success') {
        dayStat.successful++;
      } else {
        dayStat.failed++;
      }
      if (job.duration) {
        dayStat.durations.push(job.duration);
      }
    }

    const byDay = Array.from(dailyStats.entries())
      .map(([date, stats]) => ({
        date,
        total: stats.total,
        successful: stats.successful,
        failed: stats.failed,
        avgDuration: stats.durations.length > 0 
          ? stats.durations.reduce((sum, dur) => sum + dur, 0) / stats.durations.length 
          : 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Top failing jobs
    const failureCounts = new Map<string, { count: number; lastError: string }>();
    for (const job of jobs.filter(j => j.status === 'failed')) {
      const key = job.name;
      const current = failureCounts.get(key) || { count: 0, lastError: '' };
      failureCounts.set(key, {
        count: current.count + 1,
        lastError: job.error || current.lastError
      });
    }

    const topFailingJobs = Array.from(failureCounts.entries())
      .map(([jobId, info]) => ({ jobId, failureCount: info.count, error: info.lastError }))
      .sort((a, b) => b.failureCount - a.failureCount)
      .slice(0, 5);

    return {
      summary: {
        totalPipelines: jobs.length,
        successRate,
        avgDuration,
        totalArtifacts: this.buildArtifacts.size,
      },
      byDay,
      topFailingJobs,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ContinuousIntegrationOptimizationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.log('Updated CI/CD optimization configuration');
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  }

  /**
   * Generate checksum for artifact
   */
  private generateChecksum(): string {
    // In a real implementation, this would generate a proper checksum
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }

  /**
   * Get current date string in YYYY-MM-DD format
   */
  private getCurrentDateString(): string {
    return new Date().toISOString().split('T')[0];
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Close the CI/CD service
   */
  close(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.logger.log('Continuous integration optimization service closed');
  }
}