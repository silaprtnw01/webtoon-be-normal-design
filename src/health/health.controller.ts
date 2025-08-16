import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import Redis from 'ioredis';
import { StorageService } from '../storage/storage.service';

@Controller('health')
export class HealthController {
  private redis?: Redis;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {
    const url = process.env.REDIS_URL;
    if (url) this.redis = new Redis(url, { lazyConnect: true });
  }

  @Get()
  async health() {
    const checks: Record<string, string> = {};
    let dbOk = false;

    // DB
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbOk = true;
      checks.db = 'ok';
    } catch {
      checks.db = 'down';
    }

    // Redis
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

    // MinIO / S3
    try {
      const ok = await this.storage.checkBucket();
      checks.minio = ok ? 'ok' : 'down';
    } catch {
      checks.minio = 'down';
    }

    const statusOk =
      dbOk &&
      (checks.redis === 'ok' || checks.redis === 'skipped') &&
      (checks.minio === 'ok' || checks.minio === 'down'); // minio down = degraded

    return {
      status: statusOk
        ? checks.minio === 'ok'
          ? 'ok'
          : 'degraded'
        : 'degraded',
      checks,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }
}
