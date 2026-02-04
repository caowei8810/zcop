import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  port: parseInt(process.env.PORT, 10) || 3000,
  env: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'default_secret_key_for_development_only',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  rateLimit: {
    points: parseInt(process.env.RATE_LIMIT_POINTS, 10) || 10,
    duration: parseInt(process.env.RATE_LIMIT_DURATION, 10) || 60,
  },
}));