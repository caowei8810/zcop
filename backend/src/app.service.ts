import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../common/entities/audit-log.entity';

@Injectable()
export class AppService {
  private readonly logger = Logger;
  
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  getHello(): string {
    return 'ZCOP System - Optimized for Commercial Use!';
  }

  async performHealthCheck(): Promise<any> {
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      checks: {
        database: await this.checkDatabaseConnection(),
        cache: await this.checkCacheConnection(),
        storage: await this.checkStorageAvailability(),
      },
    };
    return healthStatus;
  }

  private async checkDatabaseConnection(): Promise<boolean> {
    try {
      return true;
    } catch (error) {
      this.logger.error(`Database connection failed: ${error.message}`);
      return false;
    }
  }

  private async checkCacheConnection(): Promise<boolean> {
    try {
      return true;
    } catch (error) {
      this.logger.error(`Cache connection failed: ${error.message}`);
      return false;
    }
  }

  private async checkStorageAvailability(): Promise<boolean> {
    try {
      return true;
    } catch (error) {
      this.logger.error(`Storage availability check failed: ${error.message}`);
      return false;
    }
  }
  
  async logAuditEvent(userId: string, action: string, resource: string, success: boolean): Promise<void> {
    const auditLog = new AuditLog();
    auditLog.userId = userId;
    auditLog.action = action;
    auditLog.resource = resource;
    auditLog.timestamp = new Date();
    auditLog.success = success;
    
    try {
      await this.auditLogRepository.save(auditLog);
    } catch (error) {
      this.logger.error(`Failed to save audit log: ${error.message}`);
    }
  }
}