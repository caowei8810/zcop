import { Injectable, CanActivate, ExecutionContext, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class AuditGuard implements CanActivate {
  private readonly logger = new Logger(AuditGuard.name);

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const ip = this.getClientIp(request);
    const userAgent = request.get('User-Agent');
    const method = request.method;
    const url = request.url;

    // Log the activity
    this.logger.log({
      message: 'User activity logged',
      userId: user?.id || 'unauthenticated',
      username: user?.username || 'unauthenticated',
      ip,
      userAgent,
      method,
      url,
      timestamp: new Date().toISOString(),
    });

    return true;
  }

  private getClientIp(request: any): string {
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