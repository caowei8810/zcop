import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Logger } from '@nestjs/common';

@Injectable()
export class PerformanceInterceptor implements NestInterceptor {
  private readonly logger = new Logger(PerformanceInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const method = context.getClass().name + '.' + context.getHandler().name;
    const startTime = Date.now();

    return next.handle().pipe(
      tap(() => {
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        // Log slow requests (over 500ms)
        if (duration > 500) {
          this.logger.warn(`Slow request: ${method} took ${duration}ms`, {
            method,
            url: request.url,
            userId: request.user?.id || 'anonymous',
            duration,
          });
        }

        // Could send metrics to monitoring system here
        // this.metricsService.recordTiming(method, duration);
      })
    );
  }
}