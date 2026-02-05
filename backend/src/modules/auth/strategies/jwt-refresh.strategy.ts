import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UserService } from '../modules/auth/services/user.service';
import { ErrorMonitoringService } from '../common/services/error-monitoring.service';

export interface JwtPayload {
  username: string;
  sub: string; // user ID
  roles: string[];
  iat: number;
  exp: number;
}

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(
    private configService: ConfigService,
    private userService: UserService,
    private errorMonitoringService: ErrorMonitoringService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_REFRESH_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    try {
      const user = await this.userService.findById(payload.sub);
      if (!user) {
        throw new Error('User not found');
      }

      // Check if user is still active
      if (!user.isActive) {
        throw new Error('User account is deactivated');
      }

      // Return user without password
      const { password, ...result } = user;
      return result;
    } catch (error) {
      this.errorMonitoringService.reportWarning(
        `JWT validation failed: ${error.message}`,
        'JwtRefreshStrategy.validate',
        payload.sub,
        { userId: payload.sub, error: error.message }
      );
      throw error;
    }
  }
}