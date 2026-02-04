import { Injectable, Logger, Scope } from '@nestjs/common';
import { Request, Response } from 'express';

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
}

export interface AlertConfig {
  threshold: number; // Number of occurrences before alerting
  timeWindow: number; // Time window in milliseconds
  notificationChannels: ('email' | 'slack' | 'webhook')[];
}

@Injectable({ scope: Scope.DEFAULT })
export class ErrorMonitoringService {
  private readonly logger = new Logger(ErrorMonitoringService.name);
  private errorReports: ErrorReport[] = [];
  private alertConfigs: Map<string, AlertConfig> = new Map();
  private errorCounts: Map<string, { count: number; timestamp: number }> = new Map();

  async reportError(error: any, context?: string, userId?: string, metadata?: Record<string, any>): Promise<ErrorReport> {
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
    };

    // Store the error report
    this.errorReports.push(errorReport);

    // Trim error reports to prevent memory issues (keep last 1000)
    if (this.errorReports.length > 1000) {
      this.errorReports = this.errorReports.slice(-1000);
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
    }, errorReport.stack);

    return errorReport;
  }

  async reportWarning(message: string, context?: string, userId?: string, metadata?: Record<string, any>): Promise<ErrorReport> {
    const warningReport: ErrorReport = {
      id: this.generateId(),
      timestamp: new Date(),
      level: 'warning',
      message,
      context,
      userId,
      metadata,
      handled: false,
    };

    this.errorReports.push(warningReport);

    // Trim error reports to prevent memory issues (keep last 1000)
    if (this.errorReports.length > 1000) {
      this.errorReports = this.errorReports.slice(-1000);
    }

    this.logger.warn({
      message: warningReport.message,
      context: warningReport.context,
      userId: warningReport.userId,
      errorId: warningReport.id,
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
      if (countInfo.count >= config.threshold) {
        await this.triggerAlert(alertName, errorReport, countInfo.count);
        
        // Reset counter after alerting
        this.errorCounts.set(errorKey, { count: 0, timestamp: Date.now() });
      }
    }
  }

  private async triggerAlert(alertName: string, errorReport: ErrorReport, count: number) {
    this.logger.error(`ALERT: ${alertName} triggered - ${count} occurrences in window`);
    
    // In a real implementation, this would send notifications via email, Slack, etc.
    // For now, we'll just log the alert
    console.log(`Alert triggered: ${alertName}`, {
      errorReport,
      count,
      timestamp: new Date().toISOString()
    });
  }

  private getErrorKey(errorReport: ErrorReport): string {
    // Create a key based on error message and context to group similar errors
    return `${errorReport.message.substring(0, 100)}-${errorReport.context || 'unknown'}`;
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
  }> {
    const totalErrors = this.errorReports.filter(r => r.level === 'error').length;
    const totalWarnings = this.errorReports.filter(r => r.level === 'warning').length;
    
    const errorsByContext: Record<string, number> = {};
    const errorsByDay: Record<string, number> = {};

    this.errorReports.forEach(report => {
      // Count by context
      const context = report.context || 'unknown';
      errorsByContext[context] = (errorsByContext[context] || 0) + 1;

      // Count by day
      const day = report.timestamp.toISOString().split('T')[0];
      errorsByDay[day] = (errorsByDay[day] || 0) + 1;
    });

    return {
      totalErrors,
      totalWarnings,
      errorsByContext,
      errorsByDay,
    };
  }

  async clearOldReports(maxAgeHours: number = 24) {
    const cutoffTime = new Date(Date.now() - (maxAgeHours * 60 * 60 * 1000));
    this.errorReports = this.errorReports.filter(report => report.timestamp > cutoffTime);
  }
}