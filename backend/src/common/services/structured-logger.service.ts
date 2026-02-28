import { Injectable, LoggerService, Scope } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createLogger, format, transports, Logger } from 'winston';
import * as winston from 'winston';
import 'winston-daily-rotate-file';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../entities/audit-log.entity';

@Injectable({ scope: Scope.TRANSIENT })
export class StructuredLoggerService implements LoggerService {
  private readonly logger: Logger;
  private readonly config: ConfigService;

  constructor(
    @InjectRepository(AuditLog) private auditLogRepository: Repository<AuditLog>,
    configService: ConfigService,
  ) {
    this.config = configService;
    
    const logLevel = this.config.get<string>('LOG_LEVEL') || 'info';
    const logToFile = this.config.get<boolean>('LOG_TO_FILE') || false;
    
    const logFormat = format.combine(
      format.timestamp(),
      format.errors({ stack: true }),
      format.splat(),
      format.json(),
    );

    const transportList = [
      new transports.Console({
        level: logLevel,
        format: format.combine(
          format.colorize(),
          format.printf(({ level, message, timestamp, context, ...meta }) => {
            const ctx = context ? `[${context}]` : '';
            return `${timestamp} ${level} ${ctx} ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
          }),
        ),
      }),
    ];

    if (logToFile) {
      transportList.push(
        new winston.transports.DailyRotateFile({
          filename: 'logs/application-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          level: logLevel,
          format: logFormat,
          maxSize: '20m',
          maxFiles: '7d',
        }),
      );
    }

    this.logger = createLogger({
      level: logLevel,
      format: logFormat,
      transports: transportList,
    });
  }

  log(message: any, context?: string) {
    this.logger.info(message, { context });
    this.saveToAuditLog('INFO', message, context);
  }

  error(message: any, trace?: string, context?: string) {
    this.logger.error(message, { context, trace });
    this.saveToAuditLog('ERROR', message, context, trace);
  }

  warn(message: any, context?: string) {
    this.logger.warn(message, { context });
    this.saveToAuditLog('WARN', message, context);
  }

  debug?(message: any, context?: string) {
    this.logger.debug(message, { context });
  }

  verbose?(message: any, context?: string) {
    this.logger.verbose(message, { context });
  }

  private async saveToAuditLog(level: string, message: string, context?: string, trace?: string) {
    try {
      // Only save important logs to database to avoid overwhelming it
      if (level === 'ERROR' || level === 'WARN') {
        const auditLog = new AuditLog();
        auditLog.action = `LOG_${level}`;
        auditLog.resource = context || 'SYSTEM';
        auditLog.details = typeof message === 'string' ? message : JSON.stringify(message);
        auditLog.severity = level;
        auditLog.ipAddress = 'SYSTEM'; // System-generated logs
        
        await this.auditLogRepository.save(auditLog);
      }
    } catch (err) {
      // If saving to audit log fails, at least log that failure to console
      console.error('Failed to save audit log:', err);
    }
  }

  /**
   * Custom method for structured business event logging
   */
  logBusinessEvent(eventType: string, userId: string, resource: string, details: any, ipAddress: string) {
    const message = `Business event: ${eventType}`;
    const meta = {
      userId,
      resource,
      details,
      eventType,
      ipAddress
    };
    
    this.logger.info(message, meta);
    
    // Save to audit log
    this.saveBusinessEventToAuditLog(eventType, userId, resource, details, ipAddress);
  }

  private async saveBusinessEventToAuditLog(eventType: string, userId: string, resource: string, details: any, ipAddress: string) {
    try {
      const auditLog = new AuditLog();
      auditLog.userId = userId;
      auditLog.action = eventType;
      auditLog.resource = resource;
      auditLog.details = typeof details === 'string' ? details : JSON.stringify(details);
      auditLog.severity = 'INFO';
      auditLog.ipAddress = ipAddress;
      
      await this.auditLogRepository.save(auditLog);
    } catch (err) {
      console.error('Failed to save business event audit log:', err);
    }
  }

  /**
   * Method for performance logging
   */
  logPerformance(operation: string, duration: number, context?: string, additionalData?: any) {
    const message = `Performance: ${operation} took ${duration}ms`;
    const meta = {
      operation,
      duration,
      context,
      additionalData,
      timestamp: new Date().toISOString()
    };
    
    // Log as info, but with performance-specific structure
    this.logger.info(message, meta);
  }

  /**
   * Method for security event logging
   */
  logSecurityEvent(securityEvent: string, userId: string, ipAddress: string, userAgent?: string) {
    const message = `Security event: ${securityEvent}`;
    const meta = {
      userId,
      ipAddress,
      userAgent,
      securityEvent,
      timestamp: new Date().toISOString()
    };
    
    // Always log security events as warnings
    this.logger.warn(message, meta);
    
    // Save to audit log with high severity
    this.saveSecurityEventToAuditLog(securityEvent, userId, ipAddress, userAgent);
  }

  private async saveSecurityEventToAuditLog(securityEvent: string, userId: string, ipAddress: string, userAgent?: string) {
    try {
      const auditLog = new AuditLog();
      auditLog.userId = userId;
      auditLog.action = `SECURITY_${securityEvent.toUpperCase()}`;
      auditLog.resource = 'SECURITY';
      auditLog.details = JSON.stringify({ securityEvent, userAgent });
      auditLog.severity = 'WARN';
      auditLog.ipAddress = ipAddress;
      auditLog.userAgent = userAgent;
      
      await this.auditLogRepository.save(auditLog);
    } catch (err) {
      console.error('Failed to save security event audit log:', err);
    }
  }
}