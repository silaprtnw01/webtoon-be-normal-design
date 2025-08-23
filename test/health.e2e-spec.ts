/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Health (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/health (GET)', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);

    expect(['ok', 'degraded']).toContain(res.body.status);
    expect(['ok', 'down']).toContain(res.body.checks.minio);
  });

  it('/health/readiness (GET)', async () => {
    const res = await request(app.getHttpServer())
      .get('/health/readiness')
      .expect(200);
    expect(['ready', 'not_ready']).toContain(res.body.status);
    expect(['ok', 'down']).toContain(res.body.checks.db);
  });

  it('/health/version (GET)', async () => {
    const res = await request(app.getHttpServer())
      .get('/health/version')
      .expect(200);
    expect(typeof res.body.name).toBe('string');
    expect(typeof res.body.version).toBe('string');
    expect(['development', 'test', 'production']).toContain(res.body.nodeEnv);
  });
});
