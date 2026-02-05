import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { Logger } from '@nestjs/common';

@Injectable()
export class AdvancedLoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger(AdvancedLoggingMiddleware.name);

  use(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();
    const { method, originalUrl, ip, headers } = req;
    const userAgent = headers['user-agent'];

    // Log incoming request
    this.logger.log(`Incoming: ${method} ${originalUrl}`, {
      method,
      url: originalUrl,
      ip,
      userAgent,
      userId: req.user?.id || 'anonymous',
      timestamp: new Date().toISOString(),
    });

    // Capture response details
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const { statusCode } = res;

      // Log response
      this.logger.log(`Completed: ${statusCode} ${method} ${originalUrl} (${duration}ms)`, {
        method,
        url: originalUrl,
        statusCode,
        duration,
        userId: req.user?.id || 'anonymous',
        timestamp: new Date().toISOString(),
      });

      // Log slow requests
      if (duration > 1000) {
        this.logger.warn(`Slow request detected: ${method} ${originalUrl} (${duration}ms)`, {
          duration,
          method,
          url: originalUrl,
          userId: req.user?.id || 'anonymous',
        });
      }

      // Log error responses
      if (statusCode >= 400) {
        this.logger.error(`Error response: ${statusCode} ${method} ${originalUrl}`, {
          statusCode,
          method,
          url: originalUrl,
          userId: req.user?.id || 'anonymous',
        });
      }
    });

    next();
  }
}