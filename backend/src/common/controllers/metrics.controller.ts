import { Controller, Get, Post, Body, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../modules/auth/guards/jwt-auth.guard';
import { Public } from '../../modules/auth/decorators/public.decorator';
import { AuditService } from '../services/audit.service';
import { Request } from 'express';

@ApiTags('Metrics')
@Controller('metrics')
export class MetricsController {
  constructor(private auditService: AuditService) {}

  @Public()
  @Get('health')
  @ApiOperation({ summary: 'Application health check' })
  @ApiResponse({ status: 200, description: 'Health status' })
  healthCheck(@Req() req: Request) {
    return {
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      message: 'ZCOP Platform is running smoothly',
      version: process.env.npm_package_version || '1.0.0',
      nodeVersion: process.version,
      memoryUsage: process.memoryUsage(),
      platform: process.platform,
      arch: process.arch,
      loadAverage: process.loadavg(),
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('system-stats')
  @ApiOperation({ summary: 'Get system statistics' })
  @ApiResponse({ status: 200, description: 'System statistics' })
  async getSystemStats() {
    const totalUsersQuery = `
      SELECT COUNT(*) as count FROM users
    `;
    
    const totalEntitiesQuery = `
      MATCH (n) 
      WHERE n:Entity OR n:Customer OR n:Order OR n:Product OR n:Invoice
      RETURN count(n) as count
    `;
    
    const monthlyActivitiesQuery = `
      SELECT 
        DATE_TRUNC('day', timestamp) as date,
        COUNT(*) as count
      FROM audit_logs 
      WHERE timestamp >= NOW() - INTERVAL '30 days'
      GROUP BY DATE_TRUNC('day', timestamp)
      ORDER BY date DESC
    `;
    
    // Note: These queries would need to be implemented with actual database connections
    // For now, returning mock data
    return {
      timestamp: new Date().toISOString(),
      stats: {
        totalUsers: 0, // This would come from PostgreSQL
        totalEntities: 0, // This would come from Neo4j
        monthlyActivities: [], // This would come from audit logs
        activeSessions: 0,
        apiRequestsToday: 0,
        databaseConnections: 0,
        cacheHitRate: 0,
      }
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('audit-logs')
  @ApiOperation({ summary: 'Get audit logs' })
  @ApiResponse({ status: 200, description: 'Audit logs retrieved successfully' })
  async getAuditLogs(
    @Query('userId') userId?: string,
    @Query('entity') entity?: string,
    @Query('action') action?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit: number = 50,
    @Query('offset') offset: number = 0,
  ) {
    const startDateObj = startDate ? new Date(startDate) : undefined;
    const endDateObj = endDate ? new Date(endDate) : undefined;

    return await this.auditService.getLogs(
      userId,
      entity,
      action,
      startDateObj,
      endDateObj,
      limit,
      offset,
    );
  }
}