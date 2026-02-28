import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MonitoringConfigService {
  constructor(private configService: ConfigService) {}

  getMonitoringConfig() {
    return {
      enabled: this.configService.get<boolean>('MONITORING_ENABLED') ?? true,
      interval: parseInt(this.configService.get<string>('MONITORING_INTERVAL')) || 30000, // 30 seconds
      metrics: {
        cpu: this.configService.get<boolean>('METRICS_CPU_ENABLED') ?? true,
        memory: this.configService.get<boolean>('METRICS_MEMORY_ENABLED') ?? true,
        disk: this.configService.get<boolean>('METRICS_DISK_ENABLED') ?? true,
        network: this.configService.get<boolean>('METRICS_NETWORK_ENABLED') ?? true,
        dbConnections: this.configService.get<boolean>('METRICS_DB_CONNECTIONS_ENABLED') ?? true,
        redisConnections: this.configService.get<boolean>('METRICS_REDIS_CONNECTIONS_ENABLED') ?? true,
        httpRequests: this.configService.get<boolean>('METRICS_HTTP_REQUESTS_ENABLED') ?? true,
        aiCalls: this.configService.get<boolean>('METRICS_AI_CALLS_ENABLED') ?? true,
      },
      alerts: {
        cpuThreshold: parseFloat(this.configService.get<string>('ALERT_CPU_THRESHOLD')) || 80,
        memoryThreshold: parseFloat(this.configService.get<string>('ALERT_MEMORY_THRESHOLD')) || 85,
        diskThreshold: parseFloat(this.configService.get<string>('ALERT_DISK_THRESHOLD')) || 90,
        responseTimeThreshold: parseInt(this.configService.get<string>('ALERT_RESPONSE_TIME_THRESHOLD')) || 5000,
        errorRateThreshold: parseFloat(this.configService.get<string>('ALERT_ERROR_RATE_THRESHOLD')) || 5,
      },
      retention: {
        logs: parseInt(this.configService.get<string>('MONITORING_LOGS_RETENTION')) || 30, // days
        metrics: parseInt(this.configService.get<string>('MONITORING_METRICS_RETENTION')) || 90, // days
        traces: parseInt(this.configService.get<string>('MONITORING_TRACES_RETENTION')) || 7, // days
      },
    };
  }
}