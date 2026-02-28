import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/api/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .then(response => {
        expect(response.body).toHaveProperty('status');
        expect(response.body.status).toBe('ok');
      });
  });

  it('/api/metrics/system-stats (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/metrics/system-stats')
      .expect(200)
      .then(response => {
        expect(response.body).toHaveProperty('cpuUsage');
        expect(response.body).toHaveProperty('memoryUsage');
        expect(response.body).toHaveProperty('diskUsage');
      });
  });

  it('/api/governance/data-classification (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/governance/data-classification')
      .expect(200)
      .then(response => {
        expect(Array.isArray(response.body)).toBe(true);
      });
  });

  afterEach(async () => {
    await app.close();
  });
});