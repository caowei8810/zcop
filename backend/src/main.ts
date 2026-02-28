import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger, INestApplication } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  
  try {
    // Create application instance
    const app = await NestFactory.create(AppModule, {
      logger: ['error', 'warn', 'log', 'debug', 'verbose'],
    });
    
    // Security middleware
    app.use(helmet());
    
    // CORS configuration
    app.enableCors({
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
    });
    
    // Global validation pipe
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );
    
    // API prefix
    app.setGlobalPrefix('api');
    
    // Swagger documentation
    const config = new DocumentBuilder()
      .setTitle('ZCOP API')
      .setDescription('ZeroCode Ontology Platform - Commercial-Grade API Documentation')
      .setVersion('1.0.0')
      .addBearerAuth()
      .addTag('health', 'Health check endpoints')
      .addTag('auth', 'Authentication endpoints')
      .addTag('ontology', 'Ontology management')
      .addTag('agents', 'AI agents')
      .addTag('monitoring', 'System monitoring')
      .build();
    
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api-docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
      },
    });
    
    // Get port from config
    const configService = app.get(ConfigService);
    const port = configService.get('PORT') || 3000;
    
    // Start application
    await app.listen(port);
    
    logger.log(`🚀 ZCOP Server running on port ${port}`);
    logger.log(`📚 API Documentation: http://localhost:${port}/api-docs`);
    logger.log(`🏥 Health Check: http://localhost:${port}/api/health`);
    logger.log(`🎮 GraphQL Playground: http://localhost:${port}/graphql`);
    
    // Graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      logger.log(`${signal} received. Starting graceful shutdown...`);
      await app.close();
      process.exit(0);
    };
    
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    
  } catch (error) {
    logger.error(`Failed to start server: ${error.message}`);
    process.exit(1);
  }
}

bootstrap();