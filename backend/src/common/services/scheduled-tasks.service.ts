import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AuditService } from './audit.service';
import { BackupService } from './backup.service';
import { ErrorMonitoringService } from './error-monitoring.service';

@Injectable()
export class ScheduledTasksService {
  constructor(
    private auditService: AuditService,
    private backupService: BackupService,
    private errorMonitoringService: ErrorMonitoringService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async hourlyHealthCheck() {
    // Perform hourly health checks
    console.log('Running hourly health check...');
    
    // Clean old audit logs
    await this.auditService.clearOldReports(24); // Keep only last 24 hours
    
    // Check system performance
    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();
    
    // Log performance metrics
    console.log(`Memory usage: ${JSON.stringify(memoryUsage)}`);
    console.log(`Uptime: ${uptime} seconds`);
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async dailyCleanup() {
    // Perform daily cleanup tasks
    console.log('Running daily cleanup...');
    
    try {
      // Clean audit logs older than 30 days
      await this.auditService.clearOldReports(30 * 24); // 30 days in hours
      
      // Create daily backup
      const dateStr = new Date().toISOString().split('T')[0];
      await this.backupService.createBackup(
        process.env.DB_NAME || 'zcop',
        `/backups/daily_zcop_${dateStr}.sql`,
      );
      
      console.log('Daily cleanup completed successfully');
    } catch (error) {
      console.error('Daily cleanup failed:', error);
      await this.errorMonitoringService.reportError(
        error,
        'ScheduledTasksService.dailyCleanup',
        'system',
      );
    }
  }

  @Cron(CronExpression.EVERY_30_MINUTES)
  async monitorSystemPerformance() {
    // Monitor system performance
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage ? process.cpuUsage() : { user: 0, system: 0 };
    
    // Check if memory usage is too high
    if (memoryUsage.heapUsed > 0.8 * memoryUsage.heapTotal) {
      await this.errorMonitoringService.reportWarning(
        `High memory usage detected: ${(memoryUsage.heapUsed / memoryUsage.heapTotal * 100).toFixed(2)}%`,
        'SystemMonitor.memoryUsage',
        'system',
        { memoryUsage },
      );
    }
    
    // Log performance metrics
    console.log(`Performance: Memory=${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB, CPU=${cpuUsage.user}`);
  }

  @Cron(CronExpression.EVERY_WEEK)
  async weeklyReport() {
    // Generate weekly system report
    console.log('Generating weekly report...');
    
    const errorSummary = await this.errorMonitoringService.getErrorSummary();
    const auditLogs = await this.auditService.getLogs(undefined, undefined, undefined, 
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
      new Date(),
      100, // Limit to 100 for report
      0
    );
    
    console.log(`Weekly report: ${errorSummary.totalErrors} errors, ${errorSummary.totalWarnings} warnings`);
    console.log(`Weekly report: ${auditLogs[1]} audit events`);
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async checkServiceHealth() {
    // Check external service connectivity
    console.log('Checking service health...');
    
    // In a real implementation, we would check actual service connectivity
    // For now, just log that the check ran
    console.log('Service health check completed');
  }
}