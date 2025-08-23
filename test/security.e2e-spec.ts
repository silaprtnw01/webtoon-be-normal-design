/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';

process.env.ACCESS_TOKEN_SECRET ||= 'test_access_secret_1234567890';
process.env.REFRESH_TOKEN_SECRET ||= 'test_refresh_secret_1234567890';
process.env.ACCESS_TOKEN_TTL_SEC ||= '600';
process.env.REFRESH_TOKEN_TTL_DAYS ||= '30';

describe('Security extras (e2e): revoke-others', () => {
  let app: INestApplication;
  const email = `sec_${Date.now()}@test.local`;
  const password = 'P@ssw0rd!SEC';
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let access1 = '';
  let access2 = '';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('register → gives access1', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password, displayName: 'SEC' })
      .expect(201);
    access1 = res.body.accessToken;
  });

  it('login second time → access2', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);
    access2 = res.body.accessToken;
  });

  it('revoke-others with access2 leaves only 1 active session', async () => {
    await request(app.getHttpServer())
      .post('/auth/sessions/revoke-others')
      .set('Authorization', `Bearer ${access2}`)
      .expect(200);

    const res = await request(app.getHttpServer())
      .get('/auth/sessions')
      .set('Authorization', `Bearer ${access2}`)
      .expect(200);

    const sessions = res.body as Array<any> | { sessions: any[] };
    const list = Array.isArray(sessions) ? sessions : sessions.sessions;
    const active = list.filter((s) => !s.revokedAt);
    expect(active.length).toBe(1);
  });
});
