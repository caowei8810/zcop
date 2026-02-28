import { Test, TestingModule } from '@nestjs/testing';
import { AppService } from './app.service';
import { Repository } from 'typeorm';
import { AuditLog } from './common/entities/audit-log.entity';

describe('AppService', () => {
  let service: AppService;
  let auditLogRepository: Repository<AuditLog>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppService,
        {
          provide: 'AppServiceRepository',
          useValue: {},
        },
        {
          provide: 'AuditLogRepository',
          useValue: {
            save: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AppService>(AppService);
    auditLogRepository = module.get<Repository<AuditLog>>('AuditLogRepository');
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getHello', () => {
    it('should return welcome message', () => {
      expect(service.getHello()).toBe('ZCOP System - Optimized for Commercial Use!');
    });
  });

  describe('performHealthCheck', () => {
    it('should return health status with all checks passing', async () => {
      const result = await service.performHealthCheck();
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('checks');
      expect(result.checks.database).toBe(true);
      expect(result.checks.cache).toBe(true);
      expect(result.checks.storage).toBe(true);
    });
  });

  describe('logAuditEvent', () => {
    it('should save audit log successfully', async () => {
      const saveSpy = jest.spyOn(auditLogRepository, 'save').mockResolvedValue({} as AuditLog);
      
      await service.logAuditEvent('test-user', 'login', 'auth-service', true);
      
      expect(saveSpy).toHaveBeenCalled();
    });
  });
});