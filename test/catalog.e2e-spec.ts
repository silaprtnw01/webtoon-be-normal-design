/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import * as cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

process.env.ACCESS_TOKEN_SECRET ||= 'test_access_secret_1234567890';
process.env.REFRESH_TOKEN_SECRET ||= 'test_refresh_secret_1234567890';
process.env.ACCESS_TOKEN_TTL_SEC ||= '600';
process.env.REFRESH_TOKEN_TTL_DAYS ||= '30';

describe('Catalog CRUD (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const adminEmail = `admin_${Date.now()}@test.local`;
  const userEmail = `user_${Date.now()}@test.local`;
  const password = 'P@ssw0rd!CAT';

  let userAccess = '';
  let adminAccess = '';

  let seriesId = '';
  let seriesSlug = '';
  let chapterId = '';
  let pageId = '';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.use(cookieParser.default());
    await app.init();

    prisma = app.get(PrismaService);

    // Ensure clean state for slug generation
    await prisma.page.deleteMany();
    await prisma.chapter.deleteMany();
    await prisma.series.deleteMany();

    // register normal user
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: userEmail, password, displayName: 'U' })
      .expect(201)
      .then((res) => {
        userAccess = res.body.accessToken;
      });

    // register admin then promote via DB
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: adminEmail, password, displayName: 'A' })
      .expect(201);

    const adminRole = await prisma.role.upsert({
      where: { code: 'admin' },
      update: {},
      create: { code: 'admin' },
    });
    const adminUser = await prisma.user.findUnique({
      where: { email: adminEmail },
    });
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: adminUser!.id, roleId: adminRole.id } },
      update: {},
      create: { userId: adminUser!.id, roleId: adminRole.id },
    });

    // login admin to embed role in token
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: adminEmail, password })
      .expect(200)
      .then((res) => {
        adminAccess = res.body.accessToken;
      });
  });

  afterAll(async () => {
    await app.close();
  });

  it('non-admin cannot create series -> 403', async () => {
    await request(app.getHttpServer())
      .post('/catalog/series')
      .set('Authorization', `Bearer ${userAccess}`)
      .send({ title: 'Nope', status: 'published' })
      .expect(403);
  });

  it('admin can create series (published)', async () => {
    const res = await request(app.getHttpServer())
      .post('/catalog/series')
      .set('Authorization', `Bearer ${adminAccess}`)
      .send({ title: 'Solo Leveling', status: 'published' })
      .expect(201);

    seriesId = res.body.id;
    seriesSlug = res.body.slug;
    expect(seriesId).toBeDefined();
    expect(seriesSlug).toBeDefined();
  });

  it('public list shows published series', async () => {
    const res = await request(app.getHttpServer())
      .get('/catalog/series')
      .expect(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.some((s: any) => s.slug === seriesSlug)).toBe(true);
  });

  it('get series by slug (public) returns 200', async () => {
    await request(app.getHttpServer())
      .get(`/catalog/series/${seriesSlug}`)
      .expect(200);
  });

  it('creating duplicate title produces unique slug (suffix)', async () => {
    const res = await request(app.getHttpServer())
      .post('/catalog/series')
      .set('Authorization', `Bearer ${adminAccess}`)
      .send({ title: 'Solo Leveling', status: 'draft' })
      .expect(201);
    expect(res.body.slug).not.toBe(seriesSlug);
    expect(res.body.slug.startsWith(seriesSlug)).toBe(true); // e.g., solo-leveling-2
  });

  it('admin create chapter (published) under series', async () => {
    const res = await request(app.getHttpServer())
      .post(`/catalog/series/${seriesId}/chapters`)
      .set('Authorization', `Bearer ${adminAccess}`)
      .send({ number: 1, title: 'Ep.1', status: 'published' })
      .expect(201);
    chapterId = res.body.id;
    expect(chapterId).toBeDefined();
  });

  it('public list chapters returns 1', async () => {
    const res = await request(app.getHttpServer())
      .get(`/catalog/series/${seriesId}/chapters`)
      .expect(200);
    expect(res.body.items.length).toBeGreaterThanOrEqual(1);
  });

  it('admin create page then list pages', async () => {
    const res = await request(app.getHttpServer())
      .post(`/catalog/chapters/${chapterId}/pages`)
      .set('Authorization', `Bearer ${adminAccess}`)
      .send({
        index: 1,
        imageKey: `series/${seriesSlug}/ch1/001.jpg`,
        width: 1080,
        height: 3200,
      })
      .expect(201);
    pageId = res.body.id;

    const list = await request(app.getHttpServer())
      .get(`/catalog/chapters/${chapterId}/pages`)
      .expect(200);
    expect(list.body.items.some((p: any) => p.id === pageId)).toBe(true);
  });

  it('soft delete page -> public list no longer includes it', async () => {
    await request(app.getHttpServer())
      .delete(`/catalog/pages/${pageId}`)
      .set('Authorization', `Bearer ${adminAccess}`)
      .expect(204);
    const list = await request(app.getHttpServer())
      .get(`/catalog/chapters/${chapterId}/pages`)
      .expect(200);
    expect(list.body.items.some((p: any) => p.id === pageId)).toBe(false);
  });

  it('soft delete chapter -> public list becomes empty', async () => {
    await request(app.getHttpServer())
      .delete(`/catalog/chapters/${chapterId}`)
      .set('Authorization', `Bearer ${adminAccess}`)
      .expect(204);
    const list = await request(app.getHttpServer())
      .get(`/catalog/series/${seriesId}/chapters`)
      .expect(200);
    expect(list.body.items.length).toBe(0);
  });

  it('soft delete series -> get by slug returns 404', async () => {
    await request(app.getHttpServer())
      .delete(`/catalog/series/${seriesId}`)
      .set('Authorization', `Bearer ${adminAccess}`)
      .expect(204);
    await request(app.getHttpServer())
      .get(`/catalog/series/${seriesSlug}`)
      .expect(404);
  });

  it('unauthenticated write -> 401', async () => {
    await request(app.getHttpServer())
      .post('/catalog/series')
      .send({ title: 'x' })
      .expect(401);
  });
});
