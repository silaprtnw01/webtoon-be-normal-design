## Webtoon Platform Backend (NestJS + Prisma)

Backend สำหรับ Webtoon/Content Platform ที่ใช้ NestJS 11, Prisma, PostgreSQL, Redis และ MinIO พร้อม JWT Auth, Swagger, และ Healthcheck ครบถ้วน

### คุณสมบัติเด่น

- **Auth (JWT + Refresh Rotation)**: ลงทะเบียน/ล็อกอิน/รีเฟรช/ล็อกเอาต์, ตรวจจับ token reuse, จัดการ session ต่ออุปกรณ์
- **OAuth (Google)**: เข้าสู่ระบบด้วย Google Account พร้อมการจัดการ account linking
- **RBAC**: ระบบควบคุมสิทธิ์แบบ Role-Based Access Control (user/admin)
- **Crawler System**: ระบบ crawl เนื้อหา webtoon อัตโนมัติด้วย BullMQ queue system
- **Config แบบปลอดภัย**: ตรวจสอบตัวแปรแวดล้อมด้วย Zod ก่อนบูตระบบ
- **Storage (S3/MinIO)**: ตรวจสุขภาพ bucket ด้วย HeadBucket
- **Health Endpoints**: ตรวจ DB/Redis/MinIO + readiness + version
- **Swagger Docs**: เอกสาร API ที่ `/docs` พร้อมตัวอย่าง cookie-auth
- **Rate limiting**: ป้องกัน brute-force ที่ layer ของ Auth

### สถาปัตยกรรมและสแตก

- **Runtime**: Node.js 22+, PNPM
- **Framework**: NestJS 11 (Express)
- **DB**: PostgreSQL (Prisma ORM)
- **Cache/Queue**: Redis + BullMQ
- **Object Storage**: MinIO (compatible S3)
- **Web Scraping**: Cheerio, Got
- **OAuth**: Passport (Google OAuth 2.0)
- **Docs**: Swagger-UI

---

## เริ่มต้นอย่างรวดเร็ว

### 1) ติดตั้ง dependencies

```bash
pnpm install
```

### 2) ยก services ขึ้นด้วย Docker (ตัวเลือกแนะนำ)

```bash
docker compose up -d
```

จะได้บริการต่อไปนี้:

- PostgreSQL: `localhost:5432` (user/pass/db: `postgres/postgres/webtoon`)
- Redis: `localhost:6379`
- MinIO: S3 API `localhost:9000`, Console `localhost:9001` (user/pass: `minioadmin/minioadmin`)
  Bucket `webtoon` ถูกสร้างอัตโนมัติ (ดู `docker-compose.yml`)

### 3) ตั้งค่าไฟล์ .env

ตัวอย่างค่า (แก้ไขให้ตรงสภาพแวดล้อมจริง):

```env
# Base
NODE_ENV=development
PORT=3000

# Database & Cache
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/webtoon?schema=public
REDIS_URL=redis://localhost:6379

# MinIO / S3
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=webtoon

# JWT
ACCESS_TOKEN_SECRET=change-this-to-a-strong-secret
REFRESH_TOKEN_SECRET=change-this-to-a-strong-secret
ACCESS_TOKEN_TTL_SEC=600
REFRESH_TOKEN_TTL_DAYS=30

# OAuth (Google - ตัวเลือก)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback
OAUTH_ALLOW_SIGNUP=true

# Admin (ตัวเลือก)
ADMIN_EMAIL=admin@example.com

# Crawler (ตัวเลือก)
CRAWLER_ONE_MANGA_BASE=https://one-manga.com
CRAWLER_CONCURRENCY=2
CRAWLER_RATE_MAX=5
CRAWLER_RATE_DURATION_MS=1000
CRAWLER_USER_AGENT=WebtoonBot/0.1

# Web
CORS_ORIGIN=http://localhost:3000
PUBLIC_BASE_URL=http://localhost:3000
COOKIE_DOMAIN=
```

หมายเหตุ: Service จะตรวจสอบ .env ด้วย Zod หากไม่ครบ/ไม่ถูกต้อง ระบบจะไม่บูตและบอกสาเหตุชัดเจน

### 4) Prisma (Generate/Migrate/Seed)

```bash
pnpm prisma:generate
pnpm prisma:migrate
# (ตัวเลือก) รีเซ็ต dev และ seed: pnpm prisma:dev:reset
```

### 5) รันระบบ

```bash
pnpm start:dev
# เปิด docs ที่ http://localhost:3000/docs
```

---

## สคริปต์ที่ใช้บ่อย

- `start` / `start:dev` / `start:prod`
- `build`, `lint`, `test`, `test:e2e`, `test:cov`
- `prisma:generate`, `prisma:migrate`, `prisma:dev:reset`, `prisma:studio`

---

## API หลัก

### Docs

- Swagger: เปิดที่ `/docs`

### Health

- `GET /health` ตรวจ DB/Redis/MinIO และ uptime
- `GET /health/readiness` สั้นๆ ไว้ใช้กับ probe ของ container/orchestrator
- `GET /health/version` ข้อมูลชื่อ/เวอร์ชัน/โหมดรัน

### Auth

**Local Authentication**

- `POST /auth/register` body: `{ email, password, displayName }` → ตอบกลับ `{ accessToken }` และตั้ง cookie `refresh_token`
- `POST /auth/login` body: `{ email, password, deviceId? }` → ตอบกลับ `{ accessToken }` และตั้ง cookie `refresh_token`
- `POST /auth/refresh` ใช้ cookie `refresh_token` เพื่อออกคู่ token ใหม่ (rotation)
- `POST /auth/logout` ล็อกเอาต์และล้าง cookie

**OAuth (Google)**

- `GET /auth/google` เริ่ม OAuth flow (redirect ไป Google)
- `GET /auth/google/callback` callback หลัง Google auth (auto redirect พร้อม cookie)
- `GET /auth/providers` แสดงข้อมูล providers ที่ link กับ account

**Session Management**

- `GET /auth/me` ต้องส่ง Access Token (Bearer)
- `GET /auth/sessions` ดู session ทั้งหมดของผู้ใช้ปัจจุบัน
- `DELETE /auth/sessions/:id` ยกเลิก session เฉพาะเครื่อง

หมายเหตุ

- Access Token: ส่งแบบ `Authorization: Bearer <token>`
- Refresh Token: เก็บใน HttpOnly cookie ชื่อ `refresh_token`
- มีการตรวจจับการ reuse ของ refresh token และจะ revoke session ทันที

### Catalog

- **Public**
  - `GET /catalog/series?take=20&cursor=<id>&publishedOnly=true` รายการซีรีส์แบบ cursor-based; คืน `{ items, nextCursor }` (ค่าเริ่มต้น `publishedOnly=true`)
  - `GET /catalog/series/:slug` ดูรายละเอียดซีรีส์แบบเผยแพร่เท่านั้น
  - `GET /catalog/series/:seriesId/chapters` รายการตอนของซีรีส์ (เฉพาะที่เผยแพร่)
  - `GET /catalog/chapters/:chapterId/pages` รายการหน้าของตอน

- **Admin (ต้องมี JWT + role: admin)**
  - Series: `POST /catalog/series`, `PATCH /catalog/series/:id`, `DELETE /catalog/series/:id`
  - Chapters: `POST /catalog/series/:seriesId/chapters`, `PATCH /catalog/chapters/:id`, `DELETE /catalog/chapters/:id`
  - Pages: `POST /catalog/chapters/:chapterId/pages`, `PATCH /catalog/pages/:id`, `DELETE /catalog/pages/:id`

- **พฤติกรรมสำคัญ**
  - Series/Chapter รองรับสถานะ `draft | published`; endpoint สาธารณะจะแสดงเฉพาะที่ `published`
  - สร้าง `slug` อัตโนมัติและรับประกันไม่ซ้ำ (เช่น `solo-leveling`, `solo-leveling-2`, ...)
  - ลบใช้รูปแบบ soft delete (`deletedAt`); endpoint สาธารณะจะไม่แสดงข้อมูลที่ถูกลบ
  - การ list ซีรีส์รองรับ cursor pagination; ใช้ `nextCursor` ที่ได้ไปเป็น `cursor` ในการเรียกครั้งถัดไป

### Crawler (Admin Only)

ระบบ crawl เนื้อหา webtoon อัตโนมัติด้วย BullMQ queue system รองรับ rate limiting และ retry mechanism

**Main Endpoints**

- `POST /crawler/series` body: `{ url }` → enqueue series crawling job (ต้องมี JWT + role: admin)
- `GET /crawler/metrics` → ดูสถิติ queue (enqueued, processed, failed)

**Operations (Admin)**

- `GET /crawler/stats` → ดูสถิติ queue รายละเอียด (waiting, active, completed, failed, delayed)
- `GET /crawler/jobs?state=waiting&start=0&end=49` → list jobs ตาม state
- `GET /crawler/failed?start=0&end=49` → list failed jobs
- `POST /crawler/retry/:id` → retry failed job
- `DELETE /crawler/remove/:id` → remove job จาก queue

**Hosts Management**

- `/crawler/hosts/*` → จัดการ crawler hosts/adapters (ยังไม่เปิดใช้งาน)

**พฤติกรรมสำคัญ**

- รองรับ Madara-based webtoon sites (เช่น one-manga.com)
- ใช้ BullMQ สำหรับ background processing พร้อม Redis storage
- มี rate limiting และ retry mechanism แบบ exponential backoff
- Crawl แบบ deep: Series → Chapters → Pages
- ตรวจจับและป้องกันการ duplicate jobs ด้วย jobId

---

## การตั้งค่า CORS และ Cookies

- CORS: อ่านจาก `CORS_ORIGIN` (ตั้ง `true` เมื่อไม่กำหนด)
- Cookies: โดเมนอ่านจาก `COOKIE_DOMAIN`, ใน production จะบังคับ `secure` และ `sameSite=strict`

---

## MinIO Console

- เข้าหน้า Console ได้ที่ `http://localhost:9001`
- Endpoint S3 สำหรับ client ภายในระบบอ่านจาก `MINIO_ENDPOINT` (รองรับทั้งรูปแบบมี/ไม่มีโปรโตคอล ระบบจะเติม `http://` ให้เองหากไม่มี)

---

## ทดสอบและคุณภาพโค้ด

```bash
pnpm test        # unit tests
pnpm test:e2e    # e2e tests
pnpm test:cov    # coverage
pnpm lint        # lint & fix
```

หมายเหตุ e2e:

- เพื่อความแน่นอนของชุดทดสอบ Catalog มีการล้างตาราง `Series/Chapter/Page` ก่อนเริ่ม (`test/catalog.e2e-spec.ts`)
- หากทดสอบด้วยฐานข้อมูลที่ใช้ร่วมกับงานจริง แนะนำให้ใช้ฐานข้อมูลเฉพาะสำหรับ e2e

---

## แก้ปัญหาที่พบบ่อย

- บูตไม่ขึ้นเพราะ `.env` ไม่ครบ: ดูข้อความ error จาก Zod เพื่อตั้งค่าตัวแปรให้ครบ
- ต่อ PostgreSQL ไม่ได้: ตรวจ `DATABASE_URL` และว่า container `db` ขึ้นแล้ว (`docker ps`)
- MinIO `bucket down`: ตรวจ `MINIO_ENDPOINT` และว่า container `minio` ขึ้นแล้ว, bucket `webtoon` ถูกสร้าง (มี job `minio-setup` ให้อัตโนมัติ)
- CORS: ตรวจ `CORS_ORIGIN` ให้ตรงกับ origin ของ frontend
- Cookie ไม่ติด: ใน production ต้องใช้ `https` (secure cookie)

---

## โครงสร้างโฟลเดอร์

```
webtoon-be-normal-design/
├── docker-compose.yml           # Docker services (PostgreSQL, Redis, MinIO)
├── package.json                 # Dependencies และ scripts
├── pnpm-lock.yaml              # Package lock file
├── nest-cli.json               # NestJS CLI config
├── eslint.config.mjs           # ESLint configuration
├── tsconfig.json               # TypeScript config
├── tsconfig.build.json         # Build-specific TypeScript config
├── README.md                   # เอกสารนี้
│
├── prisma/                     # Database schema และ migrations
│   ├── schema.prisma           # Prisma schema definition
│   ├── seed.ts                 # Database seeding script
│   └── migrations/             # Database migration files
│       ├── 20250816122633_init_extensions/
│       ├── 20250816123841_add_user_schema/
│       ├── 20250823121211_catalog_phase2/
│       ├── 20250824103841_crawler_external_ref/
│       ├── 20250824110919_add_delete_cuscade/
│       ├── 20250824113158_add_chapter_description/
│       ├── 20250824113342_delete/
│       └── migration_lock.toml
│
├── src/                        # Source code หลัก
│   ├── main.ts                 # Application entry point
│   ├── app.module.ts           # Root module
│   ├── app.controller.ts       # Root controller
│   ├── app.service.ts          # Root service
│   │
│   ├── auth/                   # 🔐 Authentication & Authorization
│   │   ├── auth.controller.ts  # Auth endpoints (login, register, OAuth)
│   │   ├── auth.service.ts     # Auth business logic
│   │   ├── auth.module.ts      # Auth module definition
│   │   ├── dto/                # Data Transfer Objects
│   │   │   ├── access-token.dto.ts
│   │   │   ├── login.dto.ts
│   │   │   ├── register.dto.ts
│   │   │   ├── session.dto.ts
│   │   │   └── ...
│   │   ├── guard/              # Route guards
│   │   │   ├── jwt.guard.ts
│   │   │   └── roles.guard.ts
│   │   ├── roles/              # RBAC decorators และ guards
│   │   │   ├── roles.decorator.ts
│   │   │   └── roles.guard.ts
│   │   └── strategy/           # Passport strategies
│   │       ├── jwt.strategy.ts
│   │       └── google.strategy.ts
│   │
│   ├── admin/                  # 👨‍💼 Admin-only features
│   │   ├── admin.controller.ts # Admin endpoints
│   │   └── admin.module.ts     # Admin module
│   │
│   ├── catalog/                # 📚 Content management (Series, Chapters, Pages)
│   │   ├── catalog.service.ts  # Catalog business logic
│   │   ├── catalog.module.ts   # Catalog module
│   │   ├── dto/                # DTOs for catalog entities
│   │   │   ├── series.dto.ts
│   │   │   ├── chapter.dto.ts
│   │   │   ├── page.dto.ts
│   │   │   └── query.dto.ts
│   │   ├── series/             # Series management
│   │   │   └── series.controller.ts
│   │   ├── chapters/           # Chapter management
│   │   │   └── chapters.controller.ts
│   │   └── pages/              # Page management
│   │       └── pages.controller.ts
│   │
│   ├── crawler/                # 🕷️ Web scraping system
│   │   ├── crawler.controller.ts # Crawler endpoints
│   │   ├── crawler.service.ts  # Crawler logic + BullMQ workers
│   │   ├── crawler.module.ts   # Crawler module
│   │   ├── metrics.service.ts  # Crawler metrics
│   │   ├── dto/                # Crawler DTOs
│   │   │   ├── seed.dto.ts
│   │   │   └── series-url.dto.ts
│   │   ├── adapters/           # Site-specific crawling adapters
│   │   │   └── madara.adapter.ts
│   │   ├── hosts/              # Host management
│   │   │   └── hosts.controller.ts
│   │   └── ops/                # Operations (queue management)
│   │       └── ops.controller.ts
│   │
│   ├── config/                 # ⚙️ Configuration management
│   │   ├── app-config.service.ts # Configuration service
│   │   ├── app-config.module.ts  # Config module
│   │   ├── app-info.service.ts   # App info service
│   │   └── config.schema.ts      # Zod validation schema
│   │
│   ├── health/                 # ❤️ Health check endpoints
│   │   ├── health.controller.ts # Health endpoints
│   │   ├── health.module.ts    # Health module
│   │   └── dto/                # Health DTOs
│   │       ├── health.dto.ts
│   │       └── version.dto.ts
│   │
│   ├── prisma/                 # 🗄️ Database service
│   │   ├── prisma.service.ts   # Prisma client service
│   │   └── prisma.module.ts    # Prisma module
│   │
│   ├── storage/                # 📦 Object storage (S3/MinIO)
│   │   ├── storage.service.ts  # Storage operations
│   │   └── storage.module.ts   # Storage module
│   │
│   ├── users/                  # 👤 User management
│   │   ├── users.service.ts    # User operations
│   │   └── users.module.ts     # Users module
│   │
│   └── common/                 # 🔧 Shared utilities
│       └── dto/                # Common DTOs
│           └── too-many.dto/
│               └── too-many.dto.ts
│
└── test/                       # 🧪 Test files
    ├── app.e2e-spec.ts        # Main app E2E tests
    ├── auth.e2e-spec.ts       # Auth E2E tests
    ├── catalog.e2e-spec.ts    # Catalog E2E tests
    ├── health.e2e-spec.ts     # Health E2E tests
    ├── rbac.e2e-spec.ts       # RBAC E2E tests
    ├── security.e2e-spec.ts   # Security E2E tests
    ├── rate-limit..ts         # Rate limiting tests
    └── jest-e2e.json          # Jest E2E configuration
```

### RBAC (Role-Based Access Control)

ระบบแบ่งสิทธิ์เป็น 2 ระดับ:

- **user**: ผู้ใช้ทั่วไป (เข้าถึง public APIs, จัดการ session ตัวเองได้)
- **admin**: ผู้ดูแลระบบ (สามารถจัดการ catalog, crawler, ดู admin endpoints)

**Admin Endpoints**

- `GET /admin/ping` → test admin access (ต้องมี JWT + role: admin)

**การกำหนดสิทธิ์**

- ผู้ใช้ใหม่จะได้ role 'user' โดยอัตโนมัติ
- การเปลี่ยน role เป็น admin ต้องทำผ่าน database โดยตรง
- ใช้ `@Roles('admin')` decorator ร่วมกับ `RolesGuard` ในการควบคุมสิทธิ์

---

## License

โค้ดในรีโปนี้ใช้สัญญาอนุญาตแบบส่วนตัว (UNLICENSED) ตาม `package.json`
