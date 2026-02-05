import { ExceptionFilter, Catch, ArgumentsHost, HttpException, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { ErrorMonitoringService } from '../services/error-monitoring.service';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private errorMonitoringService: ErrorMonitoringService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const userId = request.user?.id || 'anonymous';

    // Report error to monitoring service
    this.errorMonitoringService.reportError(
      exception instanceof Error ? exception : new Error(String(exception)),
      `${request.method} ${request.url}`,
      userId,
      {
        method: request.method,
        url: request.url,
        ip: this.getClientIp(request),
        userAgent: request.get('User-Agent'),
        userId,
      }
    );

    // Log the error
    this.logger.error(
      `HTTP Error occurred: ${exception instanceof Error ? exception.message : 'Unknown error'}`,
      exception instanceof Error ? exception.stack : '',
      {
        method: request.method,
        url: request.url,
        ip: request.ip,
        userId,
      }
    );

    let status: number;
    let message: string | object;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      message = exception.getResponse();
    } else {
      status = 500;
      message = {
        statusCode: 500,
        timestamp: new Date().toISOString(),
        path: request.url,
        error: 'Internal Server Error',
        ...(process.env.NODE_ENV === 'development' && {
          stack: (exception as Error).stack,
        }),
      };
    }

    // Add retry-after header for certain errors
    if (status === 429) {
      response.setHeader('Retry-After', '60'); // Retry after 60 seconds
    }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      ...(typeof message === 'string' ? { message } : message),
    });
  }

  private getClientIp(request: Request): string {
    return (
      request.headers['x-forwarded-for'] ||
      request.headers['x-real-ip'] ||
      request.connection.remoteAddress ||
      request.socket.remoteAddress ||
      (request.connection.socket ? request.connection.socket.remoteAddress : null) ||
      'unknown'
    );
  }
}