import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Neo4jModule } from 'nest-neo4j';
import { RedisModule } from '@liaoliaots/nestjs-redis';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import appConfig from './config/app.config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthController } from './common/controllers/health.controller';
import { MetricsController } from './common/controllers/metrics.controller';
import { DataGovernanceController } from './common/controllers/data-governance.controller';
import { MonitoringController } from './common/controllers/monitoring.controller';
import { OntologyModule } from './modules/ontology/ontology.module';
import { AgentsModule } from './modules/agents/agents.module';
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { PermissionGuard } from './common/guards/permission.guard';
import { LoggerMiddleware } from './common/middlewares/logger.middleware';
import { AdvancedLoggingMiddleware } from './common/middlewares/advanced-logging.middleware';
import { RateLimitMiddleware } from './common/middlewares/rate-limit.middleware';
import { AuditService } from './common/services/audit.service';
import { BackupService } from './common/services/backup.service';
import { ErrorMonitoringService } from './common/services/error-monitoring.service';
import { PerformanceInterceptor } from './common/interceptors/performance.interceptor';
import { CacheInterceptor } from './common/interceptors/cache.interceptor';
import { AuditLog } from './common/entities/audit-log.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ 
      isGlobal: true,
      load: [appConfig],
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 5432,
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_NAME || 'zcop',
      entities: [__dirname + '/**/*.entity{.ts,.js}', AuditLog], // Include audit log entity
      synchronize: true, // Only for development
    }),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: 'schema.graphql',
      sortSchema: true,
      subscriptions: {
        'subscriptions-transport-ws': {
          path: '/subscriptions',
        },
        'graphql-ws': {
          path: '/graphql',
        },
      },
    }),
    Neo4jModule.forRoot({
      scheme: process.env.NEO4J_SCHEME || 'bolt',
      host: process.env.NEO4J_HOST || 'localhost',
      port: parseInt(process.env.NEO4J_PORT) || 7687,
      username: process.env.NEO4J_USERNAME || 'neo4j',
      password: process.env.NEO4J_PASSWORD || 'neo4j',
    }),
    RedisModule.forRoot({
      config: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6379,
      },
    }),
    OntologyModule,
    AgentsModule,
    AuthModule,
  ],
  controllers: [AppController, HealthController, MetricsController, DataGovernanceController, MonitoringController],
  providers: [
    AppService,
    AuditService,
    BackupService,
    ErrorMonitoringService,
    PerformanceInterceptor,
    {
      provide: APP_INTERCEPTOR,
      useClass: PerformanceInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: CacheInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionGuard,
    },
    {
      provide: APP_PIPE,
      useClass: ValidationPipe,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(AdvancedLoggingMiddleware, RateLimitMiddleware)
      .forRoutes('*');
  }
}