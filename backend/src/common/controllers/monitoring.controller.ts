import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../modules/auth/guards/jwt-auth.guard';
import { ErrorMonitoringService, AlertConfig } from '../services/error-monitoring.service';

@ApiTags('Monitoring')
@Controller('monitoring')
export class MonitoringController {
  constructor(private errorMonitoringService: ErrorMonitoringService) {}

  @UseGuards(JwtAuthGuard)
  @Get('errors')
  @ApiOperation({ summary: 'Get recent errors' })
  @ApiResponse({ status: 200, description: 'Recent errors retrieved' })
  async getRecentErrors(@Query('limit') limit: number = 50) {
    const errors = await this.errorMonitoringService.getRecentErrors(limit);
    return {
      errors,
      count: errors.length,
      timestamp: new Date().toISOString(),
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('error-summary')
  @ApiOperation({ summary: 'Get error summary' })
  @ApiResponse({ status: 200, description: 'Error summary retrieved' })
  async getErrorSummary() {
    const summary = await this.errorMonitoringService.getErrorSummary();
    return {
      summary,
      timestamp: new Date().toISOString(),
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('alerts/configure')
  @ApiOperation({ summary: 'Configure error alerts' })
  @ApiResponse({ status: 200, description: 'Alert configured successfully' })
  async configureAlert(
    @Body('name') name: string,
    @Body('config') config: AlertConfig,
  ) {
    this.errorMonitoringService.setErrorAlert(name, config);
    return {
      message: 'Alert configured successfully',
      name,
      config,
      timestamp: new Date().toISOString(),
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('maintenance-mode')
  @ApiOperation({ summary: 'Enable/disable maintenance mode' })
  @ApiResponse({ status: 200, description: 'Maintenance mode updated' })
  async setMaintenanceMode(
    @Body('enabled') enabled: boolean,
    @Body('reason') reason?: string,
  ) {
    // In a real implementation, this would toggle maintenance mode
    // For now, we'll just return a mock response
    return {
      message: `Maintenance mode ${enabled ? 'enabled' : 'disabled'}`,
      enabled,
      reason: reason || 'No reason provided',
      timestamp: new Date().toISOString(),
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('system-performance')
  @ApiOperation({ summary: 'Get system performance metrics' })
  @ApiResponse({ status: 200, description: 'Performance metrics retrieved' })
  async getSystemPerformance() {
    const uptime = process.uptime();
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage ? process.cpuUsage() : { user: 0, system: 0 };
    
    return {
      performance: {
        uptime,
        memory: {
          rss: memoryUsage.rss,
          heapTotal: memoryUsage.heapTotal,
          heapUsed: memoryUsage.heapUsed,
          external: memoryUsage.external,
        },
        cpu: cpuUsage,
        timestamp: new Date().toISOString(),
      },
    };
  }
}