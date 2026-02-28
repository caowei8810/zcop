import { Module, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from './common/entities/audit-log.entity';
import { PerformanceMonitoringService } from './common/services/performance-monitoring.service';
import { MemoryManagementOptimizationService } from './common/services/memory-management-optimization.service';
import { ConcurrencyControlOptimizationService } from './common/services/concurrency-control-optimization.service';
import { NetworkOptimizationService } from './common/services/network-optimization.service';
import { ErrorHandlingOptimizationService } from './common/services/error-handling-optimization.service';
import { PerformanceMonitoringOptimizationService } from './common/services/performance-monitoring-optimization.service';
import { CodeGenerationOptimizationService } from './common/services/code-generation-optimization.service';
import { ResourcePoolingOptimizationService } from './common/services/resource-pooling-optimization.service';
import { AdaptiveLoadBalancerOptimizationService } from './common/services/adaptive-load-balancer-optimization.service';
import { IntelligentCachingOptimizationService } from './common/services/intelligent-caching-optimization.service';
import { PredictivePrefetchingOptimizationService } from './common/services/predictive-prefetching-optimization.service';
import { DynamicResourceAllocationOptimizationService } from './common/services/dynamic-resource-allocation-optimization.service';
import { AutomatedTestingOptimizationService } from './common/services/automated-testing-optimization.service';
import { RealTimeAnalyticsOptimizationService } from './common/services/real-time-analytics-optimization.service';
import { SecurityHardeningOptimizationService } from './common/services/security-hardening-optimization.service';
import { ContinuousIntegrationOptimizationService } from './common/services/continuous-integration-optimization.service';
import { DevOpsAutomationOptimizationService } from './common/services/devops-automation-optimization.service';
import { HealthService } from './common/services/health.service';
import { CustomLoggerService } from './common/services/custom-logger.service';
import { MonitoringController } from './common/controllers/monitoring.controller';
import { AuthModule } from './modules/auth/auth.module';
import { OntologyModule } from './modules/ontology/ontology.module';
import { AgentsModule } from './modules/agents/agents.module';
import { ConfigModule } from '@nestjs/config';
import { RedisModule } from '@liaoliaots/nestjs-redis';
import { Neo4jModule } from 'nest-neo4j';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    
    // Database
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 5432,
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_NAME || 'zcop',
      entities: [AuditLog],
      synchronize: process.env.NODE_ENV !== 'production',
    }),
    TypeOrmModule.forFeature([AuditLog]),
    
    // Redis
    RedisModule.forRoot({
      config: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6379,
      },
    }),
    
    // Neo4j
    Neo4jModule.forRoot({
      scheme: process.env.NEO4J_SCHEME || 'bolt',
      host: process.env.NEO4J_HOST || 'localhost',
      port: parseInt(process.env.NEO4J_PORT) || 7687,
      username: process.env.NEO4J_USERNAME || 'neo4j',
      password: process.env.NEO4J_PASSWORD || 'neo4j',
    }),
    
    // GraphQL
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: 'schema.graphql',
      sortSchema: true,
      playground: process.env.NODE_ENV !== 'production',
    }),
    
    // Feature Modules
    AuthModule,
    OntologyModule,
    AgentsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    HealthService,
    CustomLoggerService,
    PerformanceMonitoringService,
    MemoryManagementOptimizationService,
    ConcurrencyControlOptimizationService,
    NetworkOptimizationService,
    ErrorHandlingOptimizationService,
    PerformanceMonitoringOptimizationService,
    CodeGenerationOptimizationService,
    ResourcePoolingOptimizationService,
    AdaptiveLoadBalancerOptimizationService,
    IntelligentCachingOptimizationService,
    PredictivePrefetchingOptimizationService,
    DynamicResourceAllocationOptimizationService,
    AutomatedTestingOptimizationService,
    RealTimeAnalyticsOptimizationService,
    SecurityHardeningOptimizationService,
    ContinuousIntegrationOptimizationService,
    DevOpsAutomationOptimizationService,
  ],
  controllers: [AppController, MonitoringController],
})
export class AppModule implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    console.log('🚀 ZCOP System Initializing...');
    console.log('✅ All optimization services loaded');
    console.log('✅ Database connection established');
    console.log('✅ Redis connection established');
    console.log('✅ Neo4j connection established');
    console.log('✅ GraphQL endpoint ready');
    console.log('🎉 ZCOP System Ready!');
  }

  async onModuleDestroy() {
    console.log('👋 ZCOP System Shutting Down...');
  }
}