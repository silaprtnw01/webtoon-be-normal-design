import { Injectable } from '@nestjs/common';
import { envSchema, Env } from './config.schema';

@Injectable()
export class AppConfigService {
  private readonly env: Env;

  constructor() {
    const parsed = envSchema.safeParse(process.env);
    if (!parsed.success) {
      // อย่าพิมพ์ค่า env ลง log
      const issues = parsed.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      }));
      throw new Error(
        'Invalid environment variables: ' + JSON.stringify(issues),
      );
    }
    this.env = parsed.data;
  }

  // Runtime
  get nodeEnv() {
    return this.env.NODE_ENV;
  }
  get port() {
    return this.env.PORT;
  }

  // Web
  get publicBaseUrl() {
    return this.env.PUBLIC_BASE_URL;
  }
  get corsOrigin() {
    return this.env.CORS_ORIGIN;
  }
  get cookieDomain() {
    return this.env.COOKIE_DOMAIN;
  }

  // Data Stores
  get databaseUrl() {
    return this.env.DATABASE_URL;
  }
  get redisUrl() {
    return this.env.REDIS_URL;
  }
  get minio() {
    return {
      endpoint: this.env.MINIO_ENDPOINT,
      accessKey: this.env.MINIO_ACCESS_KEY,
      secretKey: this.env.MINIO_SECRET_KEY,
      bucket: this.env.MINIO_BUCKET,
    };
  }

  // Auth
  get jwt() {
    return {
      accessSecret: this.env.ACCESS_TOKEN_SECRET,
      refreshSecret: this.env.REFRESH_TOKEN_SECRET,
      accessTtlSec: this.env.ACCESS_TOKEN_TTL_SEC,
      refreshTtlDays: this.env.REFRESH_TOKEN_TTL_DAYS,
    };
  }

  // OAuth
  get google() {
    return {
      clientId: this.env.GOOGLE_CLIENT_ID,
      clientSecret: this.env.GOOGLE_CLIENT_SECRET,
      callbackUrl: this.env.GOOGLE_CALLBACK_URL,
    };
  }
  get oauthAllowSignup() {
    return this.env.OAUTH_ALLOW_SIGNUP;
  }

  // Admin
  get adminEmail() {
    return this.env.ADMIN_EMAIL;
  }
}
