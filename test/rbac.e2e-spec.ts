/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

// Fallback env
process.env.ACCESS_TOKEN_SECRET ||= 'test_access_secret_1234567890';
process.env.REFRESH_TOKEN_SECRET ||= 'test_refresh_secret_1234567890';

describe('RBAC /admin/ping (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const email = `rbac_${Date.now()}@test.local`;
  const password = 'P@ssw0rd!BB';

  let access = '';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    await app.init();

    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('register normal user', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password, displayName: 'RBAC' })
      .expect(201);
    access = res.body.accessToken;
  });

  it('GET /admin/ping as normal user -> 403', async () => {
    await request(app.getHttpServer())
      .get('/admin/ping')
      .set('Authorization', `Bearer ${access}`)
      .expect(403);
  });

  it('promote user to admin in DB, then /admin/ping -> 200', async () => {
    const user = await prisma.user.findUnique({ where: { email } });
    expect(user).toBeTruthy();

    const adminRole = await prisma.role.upsert({
      where: { code: 'admin' },
      update: {},
      create: { code: 'admin' },
    });

    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user!.id, roleId: adminRole.id } },
      update: {},
      create: { userId: user!.id, roleId: adminRole.id },
    });

    // login ใหม่เพื่อ refresh roles ฝั่ง token ง่ายสุด
    const res2 = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);

    const adminAccess = res2.body.accessToken;

    await request(app.getHttpServer())
      .get('/admin/ping')
      .set('Authorization', `Bearer ${adminAccess}`)
      .expect(200);
  });
});
