import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SecurityConfigService {
  constructor(private configService: ConfigService) {}

  getJwtConfig() {
    return {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: this.configService.get<string>('JWT_EXPIRES_IN') || '15m',
      refreshSecret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      refreshExpiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '7d',
    };
  }

  getRateLimitConfig() {
    return {
      points: parseInt(this.configService.get<string>('RATE_LIMIT_POINTS')) || 100,
      duration: parseInt(this.configService.get<string>('RATE_LIMIT_DURATION')) || 60,
      blockDuration: parseInt(this.configService.get<string>('RATE_LIMIT_BLOCK_DURATION')) || 300,
    };
  }

  getSecurityHeaders() {
    return {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"],
          scriptSrc: ["'self'"],
          fontSrc: ["'self'", "https:", "data:"],
          connectSrc: ["'self'", "https://*.api.com"],
        },
      },
      hsts: {
        maxAge: 31536000, // 1 year in seconds
        includeSubDomains: true,
        preload: true,
      },
      frameguard: {
        action: 'DENY',
      },
    };
  }
}