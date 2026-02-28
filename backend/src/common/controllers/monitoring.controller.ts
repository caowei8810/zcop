import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../modules/auth/guards/jwt-auth.guard';
import { HealthService } from '../common/services/health.service';

@ApiTags('Monitoring')
@Controller('monitoring')
export class MonitoringController {
  constructor(private healthService: HealthService) {}

  @Get('health')
  @ApiOperation({ summary: 'Basic health check' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  @ApiResponse({ status: 503, description: 'Service is unhealthy' })
  async health() {
    return this.healthService.check();
  }

  @Get('health/detailed')
  @ApiOperation({ summary: 'Detailed health information' })
  @ApiResponse({ status: 200, description: 'Detailed system status' })
  async detailedHealth() {
    return this.healthService.getDetailedStatus();
  }

  @Get('health/database')
  @ApiOperation({ summary: 'Database health check' })
  @ApiResponse({ status: 200, description: 'Database status' })
  async databaseHealth() {
    return this.healthService.checkDatabase();
  }

  @Get('health/redis')
  @ApiOperation({ summary: 'Redis health check' })
  @ApiResponse({ status: 200, description: 'Redis status' })
  async redisHealth() {
    return this.healthService.checkRedis();
  }

  @Get('health/memory')
  @ApiOperation({ summary: 'Memory usage check' })
  @ApiResponse({ status: 200, description: 'Memory status' })
  async memoryHealth() {
    return this.healthService.checkMemory();
  }

  @Get('metrics')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'System metrics (requires authentication)' })
  @ApiResponse({ status: 200, description: 'System metrics' })
  async metrics() {
    return {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      version: process.version,
      platform: process.platform,
    };
  }
}