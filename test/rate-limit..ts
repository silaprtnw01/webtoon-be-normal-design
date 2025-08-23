/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';

// Fallback envs สำหรับรันเทสต์
process.env.REDIS_URL ||= 'redis://localhost:6379';
process.env.ACCESS_TOKEN_SECRET ||= 'test_access_secret_1234567890';
process.env.REFRESH_TOKEN_SECRET ||= 'test_refresh_secret_1234567890';
process.env.ACCESS_TOKEN_TTL_SEC ||= '600';
process.env.REFRESH_TOKEN_TTL_DAYS ||= '30';

function getCookie(res: request.Response, name: string): string | undefined {
  const setCookie = res.header['set-cookie'] as unknown;
  const arr = Array.isArray(setCookie)
    ? setCookie
    : typeof setCookie === 'string'
      ? [setCookie]
      : [];
  if (!arr.length) return undefined;
  const found = arr.find((c) => c.startsWith(`${name}=`));
  return found?.split(';')[0];
}

describe('Rate limit (e2e)', () => {
  let app: INestApplication;
  const email = `rl_${Date.now()}@test.local`;
  const password = 'P@ssw0rd!RL';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser()); // เผื่อ main.ts ยังไม่ผูกใน env test
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('prepare: register once (also tests register throttle budget)', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password, displayName: 'RL' })
      .expect(201);
  });

  it('refresh: 20 times pass, 21st => 429', async () => {
    // login เอา refresh cookie มาเริ่ม chain
    let res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);

    let cookie = getCookie(res, 'refresh_token');
    expect(cookie).toBeDefined();

    // call 20 ครั้ง (ใน 60s) — ควรผ่านหมด
    for (let i = 0; i < 20; i++) {
      res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', cookie!)
        .expect(200);
      // รับ cookie ใหม่ทุกครั้ง (rotation)
      cookie = getCookie(res, 'refresh_token');
      expect(cookie).toBeDefined();
    }

    // ครั้งที่ 21 → ต้องโดน 429
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', cookie!)
      .expect(429);
  });

  it('login: 10 times pass, 11th => 429', async () => {
    for (let i = 0; i < 10; i++) {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password })
        .expect(200);
    }
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(429);
  });
});
