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

  get nodeEnv() {
    return this.env.NODE_ENV;
  }
  get port() {
    return this.env.PORT;
  }
  get databaseUrl() {
    return this.env.DATABASE_URL;
  }
  get redisUrl() {
    return this.env.REDIS_URL;
  }
  get corsOrigin() {
    return this.env.CORS_ORIGIN;
  }
  get minio() {
    return {
      endpoint: this.env.MINIO_ENDPOINT,
      accessKey: this.env.MINIO_ACCESS_KEY,
      secretKey: this.env.MINIO_SECRET_KEY,
      bucket: this.env.MINIO_BUCKET,
    };
  }
}
