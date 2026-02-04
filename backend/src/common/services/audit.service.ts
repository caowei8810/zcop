import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../entities/audit-log.entity';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
  ) {}

  async logActivity(
    userId: string,
    action: string,
    entity: string,
    entityId: string,
    oldValue?: any,
    newValue?: any,
    metadata?: Record<string, any>,
  ) {
    try {
      const auditLog = new AuditLog();
      auditLog.userId = userId;
      auditLog.action = action; // CREATE, UPDATE, DELETE, READ
      auditLog.entity = entity;
      auditLog.entityId = entityId;
      auditLog.oldValue = oldValue ? JSON.stringify(oldValue) : null;
      auditLog.newValue = newValue ? JSON.stringify(newValue) : null;
      auditLog.metadata = metadata || {};
      auditLog.timestamp = new Date();

      await this.auditLogRepository.save(auditLog);
    } catch (error) {
      this.logger.error('Failed to log audit activity', error);
    }
  }

  async getLogs(
    userId?: string,
    entity?: string,
    action?: string,
    startDate?: Date,
    endDate?: Date,
    limit: number = 50,
    offset: number = 0,
  ) {
    const queryBuilder = this.auditLogRepository.createQueryBuilder('audit_log')
      .orderBy('audit_log.timestamp', 'DESC')
      .skip(offset)
      .take(limit);

    if (userId) {
      queryBuilder.andWhere('audit_log.userId = :userId', { userId });
    }

    if (entity) {
      queryBuilder.andWhere('audit_log.entity = :entity', { entity });
    }

    if (action) {
      queryBuilder.andWhere('audit_log.action = :action', { action });
    }

    if (startDate) {
      queryBuilder.andWhere('audit_log.timestamp >= :startDate', { startDate });
    }

    if (endDate) {
      queryBuilder.andWhere('audit_log.timestamp <= :endDate', { endDate });
    }

    return await queryBuilder.getManyAndCount();
  }
}