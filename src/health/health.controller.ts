import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import Redis from 'ioredis';

@Controller('health')
export class HealthController {
  private redis?: Redis;

  constructor(private readonly prisma: PrismaService) {
    const url = process.env.REDIS_URL;
    if (url) this.redis = new Redis(url, { lazyConnect: true });
  }

  @Get()
  async health() {
    const checks: Record<string, string> = {};
    let dbOk = false;

    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      await this.prisma.$connect();
      dbOk = true;
      checks.db = 'ok';
    } catch {
      checks.db = 'down';
    }

    if (this.redis) {
      try {
        await this.redis.connect();
        await this.redis.ping();
        checks.redis = 'ok';
      } catch {
        checks.redis = 'down';
      } finally {
        try {
          await this.redis.quit();
        } catch {
          /* noop */
        }
      }
    } else {
      checks.redis = 'skipped';
    }

    // TODO: add MinIO readiness (need AWS SDK S3 client) — phase 0 backlog
    checks.minio = 'todo';

    return {
      status:
        dbOk && (checks.redis === 'ok' || checks.redis === 'skipped')
          ? 'ok'
          : 'degraded',
      checks,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }
}
