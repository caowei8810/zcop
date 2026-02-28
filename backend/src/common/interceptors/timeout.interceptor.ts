import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { timeout } from 'rxjs/operators';

@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // Set timeout based on route or default to 30 seconds
    const timeoutValue = this.getTimeoutValue(context) || 30000; // 30 seconds default
    
    return next.handle().pipe(timeout(timeoutValue));
  }

  private getTimeoutValue(context: ExecutionContext): number {
    const handler = context.getHandler();
    
    // Set longer timeouts for specific operations
    if (handler.name.includes('upload') || handler.name.includes('import')) {
      return 120000; // 2 minutes for file operations
    }
    
    if (handler.name.includes('export') || handler.name.includes('generate')) {
      return 60000; // 1 minute for export operations
    }
    
    // Default timeout from metadata
    return Reflect.getMetadata('timeout', handler) || 30000;
  }
}

// Decorator to set custom timeout
export const Timeout = (milliseconds: number) => {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata('timeout', milliseconds, descriptor.value);
  };
};