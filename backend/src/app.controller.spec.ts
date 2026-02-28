import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('getHello', () => {
    it('should return welcome message', () => {
      expect(appController.getHello()).toBe('ZCOP System - Optimized for Commercial Use!');
    });
  });

  describe('healthCheck', () => {
    it('should return health status', async () => {
      const result = await appController.healthCheck();
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('checks');
      expect(result.checks).toHaveProperty('database');
      expect(result.checks).toHaveProperty('cache');
      expect(result.checks).toHaveProperty('storage');
    });
  });
});