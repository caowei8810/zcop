import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, Logger } from '@nestjs/common';
import { AppService } from './app.service';
import { JwtAuthGuard } from '../modules/auth/guards/jwt-auth.guard';

@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);
  
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  async healthCheck(): Promise<any> {
    this.logger.log('Health check requested');
    return this.appService.performHealthCheck();
  }

  @UseGuards(JwtAuthGuard)
  @Get('secure-data')
  getSecureData(): string {
    return 'This is protected data accessible only with valid JWT';
  }
  
  @UseGuards(JwtAuthGuard)
  @Post('audit-log')
  async createAuditLog(@Body() auditData: { userId: string; action: string; resource: string; success: boolean }): Promise<void> {
    this.logger.log(`Audit log creation requested for user: ${auditData.userId}`);
    await this.appService.logAuditEvent(auditData.userId, auditData.action, auditData.resource, auditData.success);
  }
}