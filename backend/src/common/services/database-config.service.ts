import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class DatabaseConfigService {
  constructor(private configService: ConfigService) {}

  getPostgresConfig() {
    return {
      type: 'postgres' as const,
      host: this.configService.get<string>('DB_HOST') || 'localhost',
      port: parseInt(this.configService.get<string>('DB_PORT')) || 5432,
      username: this.configService.get<string>('DB_USERNAME') || 'postgres',
      password: this.configService.get<string>('DB_PASSWORD') || 'postgres',
      database: this.configService.get<string>('DB_NAME') || 'zcop',
      ssl: this.configService.get<boolean>('DB_SSL_ENABLED') || false,
      extra: {
        connectionTimeoutMillis: parseInt(this.configService.get<string>('DB_CONNECTION_TIMEOUT')) || 30000,
        idle_in_transaction_session_timeout: parseInt(this.configService.get<string>('DB_IDLE_TIMEOUT')) || 30000,
      },
      poolSize: parseInt(this.configService.get<string>('DB_POOL_SIZE')) || 20,
      acquireConnectionTimeout: parseInt(this.configService.get<string>('DB_ACQUIRE_TIMEOUT')) || 60000,
    };
  }

  getNeo4jConfig() {
    return {
      scheme: this.configService.get<string>('NEO4J_SCHEME') || 'bolt',
      host: this.configService.get<string>('NEO4J_HOST') || 'localhost',
      port: parseInt(this.configService.get<string>('NEO4J_PORT')) || 7687,
      username: this.configService.get<string>('NEO4J_USERNAME') || 'neo4j',
      password: this.configService.get<string>('NEO4J_PASSWORD') || 'neo4j',
      encrypted: this.configService.get<string>('NEO4J_ENCRYPTED') || 'ENCRYPTION_OFF',
      trust: this.configService.get<string>('NEO4J_TRUST') || 'TRUST_ALL_CERTIFICATES',
      maxConnectionLifetime: parseInt(this.configService.get<string>('NEO4J_MAX_CONN_LIFETIME')) || 60 * 60 * 1000, // 1 hour
      maxConnectionPoolSize: parseInt(this.configService.get<string>('NEO4J_MAX_CONN_POOL_SIZE')) || 100,
      connectionAcquisitionTimeout: parseInt(this.configService.get<string>('NEO4J_CONN_ACQUISITION_TIMEOUT')) || 2 * 60 * 1000, // 2 minutes
    };
  }

  getRedisConfig() {
    return {
      host: this.configService.get<string>('REDIS_HOST') || 'localhost',
      port: parseInt(this.configService.get<string>('REDIS_PORT')) || 6379,
      password: this.configService.get<string>('REDIS_PASSWORD'),
      db: parseInt(this.configService.get<string>('REDIS_DB')) || 0,
      keyPrefix: this.configService.get<string>('REDIS_PREFIX') || 'zcop:',
      retryDelayOnFailover: parseInt(this.configService.get<string>('REDIS_RETRY_DELAY')) || 100,
      maxRetriesPerRequest: parseInt(this.configService.get<string>('REDIS_MAX_RETRIES')) || 3,
      enableReadyCheck: true,
    };
  }
}