import { Injectable, Logger, Scope, Inject, CACHE_MANAGER } from '@nestjs/common';
import { Request, Response } from 'express';
import { Cache } from 'cache-manager';
import { ConfigService } from '@nestjs/config';

export interface ErrorReport {
  id: string;
  timestamp: Date;
  level: 'error' | 'warning' | 'info';
  message: string;
  stack?: string;
  context?: string;
  userId?: string;
  requestId?: string;
  metadata?: Record<string, any>;
  handled: boolean;
  statusCode?: number;
  userAgent?: string;
  ip?: string;
}

export interface AlertConfig {
  threshold: number; // Number of occurrences before alerting
  timeWindow: number; // Time window in milliseconds
  notificationChannels: ('email' | 'slack' | 'webhook')[];
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface SystemMetrics {
  cpuUsage: number;
  memoryUsage: number;
  activeConnections: number;
  requestRate: number;
  errorRate: number;
  uptime: number;
  timestamp: Date;
}

@Injectable({ scope: Scope.DEFAULT })
export class ErrorMonitoringService {
  private readonly logger = new Logger(ErrorMonitoringService.name);
  private errorReports: ErrorReport[] = [];
  private alertConfigs: Map<string, AlertConfig> = new Map();
  private errorCounts: Map<string, { count: number; timestamp: number }> = new Map();
  private systemMetrics: SystemMetrics[] = [];
  private readonly maxMetricsHistory: number;
  private readonly maxErrorHistory: number;
  private alertCooldowns: Map<string, number> = new Map(); // Prevent alert spam

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private configService: ConfigService,
  ) {
    this.maxMetricsHistory = this.configService.get<number>('MAX_METRICS_HISTORY') || 1000;
    this.maxErrorHistory = this.configService.get<number>('MAX_ERROR_HISTORY') || 10000;
    
    // Set up periodic cleanup
    setInterval(() => {
      this.cleanupOldEntries();
    }, 300000); // Clean up every 5 minutes
  }

  async reportError(error: any, context?: string, userId?: string, metadata?: Record<string, any>, 
                   statusCode?: number, userAgent?: string, ip?: string): Promise<ErrorReport> {
    const errorReport: ErrorReport = {
      id: this.generateId(),
      timestamp: new Date(),
      level: 'error',
      message: error.message || String(error),
      stack: error.stack,
      context,
      userId,
      metadata,
      handled: false,
      statusCode,
      userAgent,
      ip,
    };

    // Store the error report
    this.errorReports.push(errorReport);

    // Trim error reports to prevent memory issues
    if (this.errorReports.length > this.maxErrorHistory) {
      this.errorReports = this.errorReports.slice(-this.maxErrorHistory);
    }

    // Track error counts for alerting
    const errorKey = this.getErrorKey(errorReport);
    const currentTime = Date.now();
    const existing = this.errorCounts.get(errorKey);

    if (existing && (currentTime - existing.timestamp) < 300000) { // 5 minute window
      existing.count++;
      existing.timestamp = currentTime;
    } else {
      this.errorCounts.set(errorKey, { count: 1, timestamp: currentTime });
    }

    // Check if we need to trigger an alert
    await this.checkAlerts(errorReport);

    // Log the error
    this.logger.error({
      message: errorReport.message,
      context: errorReport.context,
      userId: errorReport.userId,
      errorId: errorReport.id,
      statusCode: errorReport.statusCode,
      ip: errorReport.ip,
    }, errorReport.stack);

    // Cache critical errors for quick retrieval
    if (errorReport.level === 'error' && errorReport.statusCode && errorReport.statusCode >= 500) {
      const cacheKey = `critical_error_${errorReport.id}`;
      await this.cacheManager.set(cacheKey, errorReport, 3600); // Cache for 1 hour
    }

    return errorReport;
  }

  async reportWarning(message: string, context?: string, userId?: string, metadata?: Record<string, any>,
                     userAgent?: string, ip?: string): Promise<ErrorReport> {
    const warningReport: ErrorReport = {
      id: this.generateId(),
      timestamp: new Date(),
      level: 'warning',
      message,
      context,
      userId,
      metadata,
      handled: false,
      userAgent,
      ip,
    };

    this.errorReports.push(warningReport);

    // Trim error reports to prevent memory issues
    if (this.errorReports.length > this.maxErrorHistory) {
      this.errorReports = this.errorReports.slice(-this.maxErrorHistory);
    }

    this.logger.warn({
      message: warningReport.message,
      context: warningReport.context,
      userId: warningReport.userId,
      errorId: warningReport.id,
      ip: warningReport.ip,
    });

    return warningReport;
  }

  setErrorAlert(name: string, config: AlertConfig) {
    this.alertConfigs.set(name, config);
  }

  async checkAlerts(errorReport: ErrorReport) {
    const errorKey = this.getErrorKey(errorReport);
    const countInfo = this.errorCounts.get(errorKey);

    if (!countInfo) return;

    // Check each alert configuration
    for (const [alertName, config] of this.alertConfigs.entries()) {
      // Check for alert cooldown to prevent spam
      const cooldownKey = `${alertName}:${errorKey}`;
      const lastAlertTime = this.alertCooldowns.get(cooldownKey) || 0;
      const cooldownPeriod = 300000; // 5 minutes cooldown
      
      if (Date.now() - lastAlertTime < cooldownPeriod) {
        continue; // Skip if still in cooldown period
      }

      if (countInfo.count >= config.threshold) {
        await this.triggerAlert(alertName, errorReport, countInfo.count, config.severity);
        
        // Update cooldown timer
        this.alertCooldowns.set(cooldownKey, Date.now());
        
        // Reset counter after alerting
        this.errorCounts.set(errorKey, { count: 0, timestamp: Date.now() });
      }
    }
  }

  private async triggerAlert(alertName: string, errorReport: ErrorReport, count: number, severity: string) {
    this.logger.error(`ALERT [${severity.toUpperCase()}]: ${alertName} triggered - ${count} occurrences in window`);
    
    // In a real implementation, this would send notifications via email, Slack, etc.
    // For now, we'll log the alert and potentially call external services
    const alertPayload = {
      alertName,
      errorReport,
      count,
      severity,
      timestamp: new Date().toISOString(),
      service: 'ZCOP Platform',
    };
    
    console.log(`Alert triggered:`, alertPayload);
    
    // Store alert in cache for monitoring dashboards
    const alertKey = `alert:${alertName}:${Date.now()}`;
    await this.cacheManager.set(alertKey, alertPayload, 7200); // Cache for 2 hours
  }

  private getErrorKey(errorReport: ErrorReport): string {
    // Create a key based on error message and context to group similar errors
    return `${errorReport.message.substring(0, 100)}-${errorReport.context || 'unknown'}-${errorReport.statusCode || 'unknown'}`;
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  }

  async getRecentErrors(limit: number = 50): Promise<ErrorReport[]> {
    return this.errorReports
      .filter(report => report.level === 'error')
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  async getErrorSummary(): Promise<{
    totalErrors: number;
    totalWarnings: number;
    errorsByContext: Record<string, number>;
    errorsByDay: Record<string, number>;
    errorsByStatusCode: Record<string, number>;
    errorRate: number; // Errors per minute
  }> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000); // Last hour
    const errorsLastHour = this.errorReports.filter(r => 
      r.timestamp >= oneHourAgo && r.level === 'error'
    );

    const totalErrors = this.errorReports.filter(r => r.level === 'error').length;
    const totalWarnings = this.errorReports.filter(r => r.level === 'warning').length;
    
    const errorsByContext: Record<string, number> = {};
    const errorsByDay: Record<string, number> = {};
    const errorsByStatusCode: Record<string, number> = {};

    this.errorReports.forEach(report => {
      // Count by context
      const context = report.context || 'unknown';
      errorsByContext[context] = (errorsByContext[context] || 0) + 1;

      // Count by day
      const day = report.timestamp.toISOString().split('T')[0];
      errorsByDay[day] = (errorsByDay[day] || 0) + 1;

      // Count by status code
      if (report.statusCode) {
        const statusCode = report.statusCode.toString();
        errorsByStatusCode[statusCode] = (errorsByStatusCode[statusCode] || 0) + 1;
      }
    });

    // Calculate error rate (errors per minute in the last hour)
    const errorRate = errorsLastHour.length / 60; // Per minute average

    return {
      totalErrors,
      totalWarnings,
      errorsByContext,
      errorsByDay,
      errorsByStatusCode,
      errorRate,
    };
  }

  async clearOldReports(maxAgeHours: number = 24) {
    const cutoffTime = new Date(Date.now() - (maxAgeHours * 60 * 60 * 1000));
    this.errorReports = this.errorReports.filter(report => report.timestamp > cutoffTime);
  }

  private cleanupOldEntries() {
    // Remove old error counts
    const now = Date.now();
    const timeWindow = 300000; // 5 minutes
    for (const [key, countInfo] of this.errorCounts.entries()) {
      if (now - countInfo.timestamp > timeWindow) {
        this.errorCounts.delete(key);
      }
    }
    
    // Clean up alert cooldowns
    for (const [key, time] of this.alertCooldowns.entries()) {
      if (now - time > 300000) { // 5 minutes
        this.alertCooldowns.delete(key);
      }
    }
  }

  // Add system metrics tracking
  async recordSystemMetrics(metrics: Partial<SystemMetrics>) {
    const fullMetrics: SystemMetrics = {
      cpuUsage: metrics.cpuUsage || 0,
      memoryUsage: metrics.memoryUsage || 0,
      activeConnections: metrics.activeConnections || 0,
      requestRate: metrics.requestRate || 0,
      errorRate: metrics.errorRate || 0,
      uptime: metrics.uptime || 0,
      timestamp: metrics.timestamp || new Date(),
    };

    this.systemMetrics.push(fullMetrics);

    // Keep only the most recent metrics
    if (this.systemMetrics.length > this.maxMetricsHistory) {
      this.systemMetrics = this.systemMetrics.slice(-this.maxMetricsHistory);
    }

    // Cache latest metrics
    await this.cacheManager.set('latest_system_metrics', fullMetrics, 60); // Cache for 1 minute
  }

  async getSystemMetrics(hoursBack: number = 1): Promise<SystemMetrics[]> {
    const cutoffTime = new Date(Date.now() - (hoursBack * 60 * 60 * 1000));
    return this.systemMetrics
      .filter(metric => metric.timestamp >= cutoffTime)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async getLatestMetrics(): Promise<SystemMetrics> {
    if (this.systemMetrics.length === 0) {
      return {
        cpuUsage: 0,
        memoryUsage: 0,
        activeConnections: 0,
        requestRate: 0,
        errorRate: 0,
        uptime: 0,
        timestamp: new Date(),
      };
    }
    
    return this.systemMetrics[this.systemMetrics.length - 1];
  }

  // Enhanced alerting for system metrics
  async checkSystemMetrics(metrics: SystemMetrics) {
    // CPU usage alert (>80%)
    if (metrics.cpuUsage > 80) {
      await this.reportWarning(
        `High CPU usage detected: ${metrics.cpuUsage}%`,
        'SystemMonitor',
        undefined,
        { cpuUsage: metrics.cpuUsage }
      );
    }

    // Memory usage alert (>85%)
    if (metrics.memoryUsage > 85) {
      await this.reportWarning(
        `High memory usage detected: ${metrics.memoryUsage}%`,
        'SystemMonitor',
        undefined,
        { memoryUsage: metrics.memoryUsage }
      );
    }

    // High error rate alert (>10 errors per minute)
    if (metrics.errorRate > 10) {
      await this.reportWarning(
        `High error rate detected: ${metrics.errorRate} errors/minute`,
        'SystemMonitor',
        undefined,
        { errorRate: metrics.errorRate }
      );
    }
  }
}