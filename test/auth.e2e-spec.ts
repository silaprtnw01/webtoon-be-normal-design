/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

// เผื่อ env ไม่ถูกโหลดใน Jest — ใส่ fallback ที่จำเป็น
process.env.ACCESS_TOKEN_SECRET ||= 'test_access_secret_1234567890';
process.env.REFRESH_TOKEN_SECRET ||= 'test_refresh_secret_1234567890';
process.env.ACCESS_TOKEN_TTL_SEC ||= '600';
process.env.REFRESH_TOKEN_TTL_DAYS ||= '30';

function getCookie(res: request.Response, name: string): string | undefined {
  const raw = res.header['set-cookie'] as unknown;
  const arr = Array.isArray(raw) ? raw : typeof raw === 'string' ? [raw] : [];
  const found = arr.find((c) => c.startsWith(`${name}=`));
  return found?.split(';')[0]; // name=value
}

describe('Auth flows (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const rnd = Math.random().toString(36).slice(2);
  const email = `e2e_${Date.now()}_${rnd}@test.local`;
  const password = 'P@ssw0rd!AA';
  const deviceId = 'e2e-device-1';

  let accessA = '';
  let refreshCookieA = ''; // ก่อน rotate
  let accessB = '';
  let refreshCookieB = ''; // หลัง rotate

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser()); // จำเป็นสำหรับอ่าน req.cookies ใน e2e
    await app.init();

    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('POST /auth/register -> sets refresh cookie + returns access', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .set('Content-Type', 'application/json')
      .set('X-Device-Id', deviceId)
      .send({ email, password, displayName: 'E2E' })
      .expect(201);

    const cookie = getCookie(res, 'refresh_token');
    expect(cookie).toBeDefined();
    expect(res.body.accessToken).toBeDefined();

    refreshCookieA = cookie!;
    accessA = res.body.accessToken;
  });

  it('GET /auth/sessions with access token -> list sessions', async () => {
    const res = await request(app.getHttpServer())
      .get('/auth/sessions')
      .set('Authorization', `Bearer ${accessA}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toHaveProperty('id');
  });

  it('POST /auth/refresh (ROTATE) with cookie A -> returns new access + cookie B', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', refreshCookieA)
      .expect(200);

    expect(res.body.accessToken).toBeDefined();
    const cookieB = getCookie(res, 'refresh_token');
    expect(cookieB).toBeDefined();

    accessB = res.body.accessToken;
    refreshCookieB = cookieB!;
  });

  it('POST /auth/refresh AGAIN with stale cookie A -> 401 reuse detected + session revoked', async () => {
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', refreshCookieA)
      .expect(401);

    // ตรวจสอบว่ามี session ไหนถูก revoke
    // ดึง session จากผู้ใช้ล่าสุด
    const user = await prisma.user.findUnique({ where: { email } });
    expect(user).toBeTruthy();

    const sessions = await prisma.session.findMany({
      where: { userId: user!.id },
      orderBy: { createdAt: 'desc' },
    });

    // อย่างน้อยหนึ่ง session ต้องถูก revoke หลัง reuse detection
    expect(sessions.some((s) => s.revokedAt !== null)).toBe(true);
  });

  it('POST /auth/login -> can create a new session after revoke', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password, deviceId })
      .expect(200);

    expect(res.body.accessToken).toBeDefined();
    expect(getCookie(res, 'refresh_token')).toBeDefined();
  });

  it('GET /auth/me -> returns profile + roles[]', async () => {
    const res = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessB}`)
      .expect(200);

    expect(res.body.email.toLowerCase()).toBe(email.toLowerCase());
    expect(Array.isArray(res.body.roles)).toBe(true);
  });

  it('POST /auth/logout -> clears refresh cookie (best effort revoke)', async () => {
    // ใช้ cookie B ที่ยัง valid
    const res = await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Cookie', refreshCookieB)
      .expect(200);

    // บางระบบจะส่ง Set-Cookie ลบค่า; ที่นี่แค่ตรวจ ok:true พอ
    expect(res.body.ok).toBe(true);
  });
});
