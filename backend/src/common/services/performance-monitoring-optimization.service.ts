import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface PerformanceMetric {
  id: string;
  name: string;
  value: number;
  unit: string;
  timestamp: Date;
  tags?: Record<string, string>;
  metadata?: any;
}

export interface PerformanceThreshold {
  metricName: string;
  warningThreshold: number;
  criticalThreshold: number;
  unit: string;
}

export interface ProfilingConfig {
  enabled: boolean;
  samplingRate: number; // Percentage of requests to profile
  thresholdMs: number; // Minimum execution time to record
  maxProfiles: number;
}

export interface PerformanceProfile {
  id: string;
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  memoryBefore?: number;
  memoryAfter?: number;
  cpuBefore?: number;
  cpuAfter?: number;
  error?: string;
  tags?: Record<string, string>;
}

@Injectable()
export class PerformanceMonitoringOptimizationService {
  private readonly logger = new Logger(PerformanceMonitoringOptimizationService.name);
  private metrics: PerformanceMetric[] = [];
  private thresholds: PerformanceThreshold[] = [];
  private profiles: Map<string, PerformanceProfile> = new Map();
  private config: ProfilingConfig;
  private readonly maxMetrics: number;
  private readonly maxProfiles: number;

  constructor(private configService: ConfigService) {
    this.config = {
      enabled: this.configService.get<boolean>('PERFORMANCE_PROFILING_ENABLED') ?? true,
      samplingRate: this.configService.get<number>('PERFORMANCE_SAMPLING_RATE') || 100,
      thresholdMs: this.configService.get<number>('PERFORMANCE_THRESHOLD_MS') || 100,
      maxProfiles: this.configService.get<number>('PERFORMANCE_MAX_PROFILES') || 1000,
    };
    this.maxMetrics = this.configService.get<number>('PERFORMANCE_MAX_METRICS') || 10000;
    this.maxProfiles = this.configService.get<number>('PERFORMANCE_MAX_PROFILES') || 1000;
  }

  /**
   * Record a performance metric
   */
  recordMetric(
    name: string,
    value: number,
    unit: string,
    tags?: Record<string, string>,
    metadata?: any
  ): void {
    const metric: PerformanceMetric = {
      id: this.generateId(),
      name,
      value,
      unit,
      timestamp: new Date(),
      tags,
      metadata,
    };

    this.metrics.push(metric);

    // Trim metrics if we exceed the limit
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }

    // Check thresholds
    this.checkThresholds(metric);

    this.logger.debug(`Recorded metric: ${name} = ${value}${unit}`);
  }

  /**
   * Start profiling a function or operation
   */
  startProfiling(name: string, tags?: Record<string, string>): string {
    if (!this.config.enabled) {
      return '';
    }

    // Random sampling based on sampling rate
    if (Math.random() * 100 > this.config.samplingRate) {
      return ''; // Skip profiling for this execution
    }

    const profileId = this.generateId();
    const startTime = Date.now();
    
    // Get initial resource usage
    const startMemory = process.memoryUsage();
    const startCPU = process.cpuUsage?.() || { user: 0, system: 0 };

    const profile: PerformanceProfile = {
      id: profileId,
      name,
      startTime,
      memoryBefore: startMemory.heapUsed,
      cpuBefore: startCPU.user + startCPU.system,
      tags,
    };

    this.profiles.set(profileId, profile);
    
    // Trim profiles if we exceed the limit
    if (this.profiles.size > this.maxProfiles) {
      const oldestId = this.profiles.keys().next().value;
      this.profiles.delete(oldestId);
    }

    return profileId;
  }

  /**
   * End profiling and record the results
   */
  endProfiling(
    profileId: string,
    error?: string,
    metadata?: any
  ): PerformanceProfile | null {
    if (!profileId || !this.profiles.has(profileId)) {
      return null;
    }

    const profile = this.profiles.get(profileId)!;
    const endTime = Date.now();
    
    // Get final resource usage
    const endMemory = process.memoryUsage();
    const endCPU = process.cpuUsage?.() || { user: 0, system: 0 };

    profile.endTime = endTime;
    profile.duration = endTime - profile.startTime;
    profile.memoryAfter = endMemory.heapUsed;
    profile.cpuAfter = endCPU.user + endCPU.system;
    profile.error = error;
    
    // Add metadata
    if (metadata) {
      profile['metadata'] = metadata;
    }

    // Record duration metric
    if (profile.duration) {
      this.recordMetric(
        `${profile.name}.duration`,
        profile.duration,
        'ms',
        profile.tags,
        { profileId, ...metadata }
      );

      // Check if the operation was slow
      if (profile.duration > this.config.thresholdMs) {
        this.logger.warn(
          `Slow operation detected: ${profile.name} took ${profile.duration}ms`,
          { profileId, tags: profile.tags }
        );
      }
    }

    // Record memory usage
    if (profile.memoryAfter && profile.memoryBefore) {
      const memoryDelta = profile.memoryAfter - profile.memoryBefore;
      this.recordMetric(
        `${profile.name}.memory.delta`,
        memoryDelta,
        'bytes',
        profile.tags,
        { profileId }
      );
    }

    return profile;
  }

  /**
   * Profile a function execution
   */
  async profileOperation<T>(
    name: string,
    operation: () => Promise<T>,
    tags?: Record<string, string>,
    metadata?: any
  ): Promise<T> {
    const profileId = this.startProfiling(name, tags);
    
    try {
      const result = await operation();
      this.endProfiling(profileId, undefined, metadata);
      return result;
    } catch (error) {
      this.endProfiling(profileId, error.message, metadata);
      throw error;
    }
  }

  /**
   * Set performance thresholds
   */
  setThreshold(threshold: PerformanceThreshold): void {
    // Remove existing threshold for this metric
    this.thresholds = this.thresholds.filter(t => t.metricName !== threshold.metricName);
    this.thresholds.push(threshold);
    this.logger.log(`Set threshold for ${threshold.metricName}: warning=${threshold.warningThreshold}, critical=${threshold.criticalThreshold}`);
  }

  /**
   * Check if a metric exceeds any thresholds
   */
  private checkThresholds(metric: PerformanceMetric): void {
    const applicableThresholds = this.thresholds.filter(t => t.metricName === metric.name);
    
    for (const threshold of applicableThresholds) {
      let level: 'warning' | 'critical' | null = null;
      
      if (metric.unit === threshold.unit) {
        if (metric.value >= threshold.criticalThreshold) {
          level = 'critical';
        } else if (metric.value >= threshold.warningThreshold) {
          level = 'warning';
        }
      }

      if (level) {
        const message = `Performance ${level.toUpperCase()}: ${metric.name} = ${metric.value}${metric.unit} (threshold: ${threshold[level + 'Threshold']}${threshold.unit})`;
        
        if (level === 'critical') {
          this.logger.error(message, { metric, threshold });
        } else {
          this.logger.warn(message, { metric, threshold });
        }
      }
    }
  }

  /**
   * Get performance metrics
   */
  getMetrics(
    name?: string,
    startTime?: Date,
    endTime?: Date,
    tags?: Record<string, string>
  ): PerformanceMetric[] {
    let filtered = this.metrics;

    if (name) {
      filtered = filtered.filter(m => m.name === name);
    }

    if (startTime) {
      filtered = filtered.filter(m => m.timestamp >= startTime);
    }

    if (endTime) {
      filtered = filtered.filter(m => m.timestamp <= endTime);
    }

    if (tags) {
      filtered = filtered.filter(m => {
        if (!m.tags) return false;
        return Object.entries(tags).every(([key, value]) => m.tags?.[key] === value);
      });
    }

    return filtered;
  }

  /**
   * Get performance profiles
   */
  getProfiles(
    name?: string,
    startTime?: number,
    endTime?: number,
    hasError?: boolean
  ): PerformanceProfile[] {
    let filtered = Array.from(this.profiles.values());

    if (name) {
      filtered = filtered.filter(p => p.name === name);
    }

    if (startTime) {
      filtered = filtered.filter(p => p.startTime >= startTime);
    }

    if (endTime) {
      filtered = filtered.filter(p => p.endTime && p.endTime <= endTime);
    }

    if (hasError !== undefined) {
      filtered = filtered.filter(p => !!p.error === hasError);
    }

    return filtered;
  }

  /**
   * Get aggregated metrics
   */
  getAggregatedMetrics(
    name: string,
    aggregation: 'avg' | 'min' | 'max' | 'sum' | 'count',
    startTime?: Date,
    endTime?: Date
  ): number | null {
    const metrics = this.getMetrics(name, startTime, endTime);
    
    if (metrics.length === 0) {
      return null;
    }

    switch (aggregation) {
      case 'avg':
        return metrics.reduce((sum, m) => sum + m.value, 0) / metrics.length;
      case 'min':
        return Math.min(...metrics.map(m => m.value));
      case 'max':
        return Math.max(...metrics.map(m => m.value));
      case 'sum':
        return metrics.reduce((sum, m) => sum + m.value, 0);
      case 'count':
        return metrics.length;
      default:
        return null;
    }
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(): {
    totalMetrics: number;
    totalProfiles: number;
    avgDuration: number;
    slowOperations: number;
    memoryIssues: number;
    thresholdBreaches: number;
  } {
    const totalMetrics = this.metrics.length;
    const totalProfiles = this.profiles.size;
    
    // Calculate average duration from profiles
    const durations = Array.from(this.profiles.values())
      .map(p => p.duration)
      .filter(d => d !== undefined) as number[];
    
    const avgDuration = durations.length > 0 
      ? durations.reduce((sum, dur) => sum + dur, 0) / durations.length 
      : 0;
    
    // Count slow operations
    const slowOperations = durations.filter(dur => dur > this.config.thresholdMs).length;
    
    // Count potential memory issues
    const memoryProfiles = Array.from(this.profiles.values())
      .filter(p => p.memoryBefore !== undefined && p.memoryAfter !== undefined);
    
    const memoryIncreases = memoryProfiles
      .map(p => (p.memoryAfter! - p.memoryBefore!) / p.memoryBefore! * 100)
      .filter(increase => increase > 10); // More than 10% increase
    
    const memoryIssues = memoryIncreases.length;
    
    // Count threshold breaches
    let thresholdBreaches = 0;
    for (const metric of this.metrics) {
      for (const threshold of this.thresholds) {
        if (metric.name === threshold.metricName && metric.unit === threshold.unit) {
          if (metric.value >= threshold.criticalThreshold) {
            thresholdBreaches++;
          }
        }
      }
    }

    return {
      totalMetrics,
      totalProfiles,
      avgDuration,
      slowOperations,
      memoryIssues,
      thresholdBreaches,
    };
  }

  /**
   * Export metrics in a specific format
   */
  exportMetrics(format: 'json' | 'csv' = 'json'): string {
    switch (format) {
      case 'csv':
        const headers = ['id', 'name', 'value', 'unit', 'timestamp'];
        const rows = this.metrics.map(m => [
          m.id,
          `"${m.name}"`,
          m.value,
          `"${m.unit}"`,
          m.timestamp.toISOString()
        ]);
        
        return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
        
      case 'json':
      default:
        return JSON.stringify(this.metrics, null, 2);
    }
  }

  /**
   * Clear all metrics
   */
  clearMetrics(): void {
    this.metrics = [];
    this.logger.log('Cleared all performance metrics');
  }

  /**
   * Clear all profiles
   */
  clearProfiles(): void {
    this.profiles.clear();
    this.logger.log('Cleared all performance profiles');
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  }

  /**
   * Update profiling configuration
   */
  updateConfig(newConfig: Partial<ProfilingConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.log('Updated performance monitoring configuration');
  }
}