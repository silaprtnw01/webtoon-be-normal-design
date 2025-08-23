import { z } from 'zod';

export const envSchema = z.object({
  // Runtime
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  // Database & Cache
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),

  // Object Storage (MinIO / S3)
  MINIO_ENDPOINT: z.string().min(1),
  MINIO_ACCESS_KEY: z.string().min(1),
  MINIO_SECRET_KEY: z.string().min(1),
  MINIO_BUCKET: z.string().default('webtoon'),

  // Web / CORS / Base URL
  CORS_ORIGIN: z.string().optional(),
  PUBLIC_BASE_URL: z.string().url({ error: 'Invalid URL' }).optional(),
  COOKIE_DOMAIN: z.string().optional(),

  // JWT
  ACCESS_TOKEN_SECRET: z.string().min(16),
  REFRESH_TOKEN_SECRET: z.string().min(16),
  ACCESS_TOKEN_TTL_SEC: z.coerce.number().int().positive().default(600),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),

  // OAuth (Google)
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CALLBACK_URL: z.string().url({ error: 'Invalid URL' }).optional(),
  OAUTH_ALLOW_SIGNUP: z.coerce.boolean().default(true),

  // Admin
  ADMIN_EMAIL: z.string().email({ error: 'Invalid email' }).optional(),
});
export type Env = z.infer<typeof envSchema>;
