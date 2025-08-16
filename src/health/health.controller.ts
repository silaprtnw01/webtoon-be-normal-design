import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import Redis from 'ioredis';
import { StorageService } from '../storage/storage.service';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { HealthResponseDto, ReadinessResponseDto } from './dto/health.dto';

@ApiTags('Health')
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
  @ApiOkResponse({ type: HealthResponseDto })
  async health(): Promise<HealthResponseDto> {
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

    const status: 'ok' | 'degraded' =
      dbOk &&
      (checks.redis === 'ok' || checks.redis === 'skipped') &&
      checks.minio === 'ok'
        ? 'ok'
        : 'degraded';

    return {
      status,
      // type assertion: map string -> literal unions defined in DTO
      checks: checks as any,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }

  @Get('readiness')
  @ApiOkResponse({ type: ReadinessResponseDto })
  async readiness(): Promise<ReadinessResponseDto> {
    let dbOk = false;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbOk = true;
    } catch {
      /* noop */
    }

    return {
      status: dbOk ? ('ready' as const) : ('not_ready' as const),
      checks: { db: dbOk ? 'ok' : 'down' },
      timestamp: new Date().toISOString(),
    };
  }
}
