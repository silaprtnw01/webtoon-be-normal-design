import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AppConfigService } from '../config/app-config.service';
import IORedis from 'ioredis';
import { Queue } from 'bullmq';

type QueueStats = {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
};

type DbStats = {
  series: number;
  chapters: number;
  pages: number;
  externalRefs: {
    series: number;
    chapters: number;
  };
};

export type HostInfo = {
  host: string;
  baseUrl: string;
  source: string;
};

export type HostMetrics = HostInfo & {
  queue: QueueStats;
  db: DbStats;
};

@Injectable()
export class MetricsService {
  private redis: IORedis;
  private queue: Queue;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cfg: AppConfigService,
  ) {
    this.redis = new IORedis(this.cfg.redisUrl);
    // ตอนนี้มีคิวเดียวสำหรับ one-manga
    this.queue = new Queue('crawler-one-manga', {
      connection: this.redis as any,
    });
  }

  listHosts(): HostInfo[] {
    const base = this.cfg.crawler.base;
    if (!base) return [];
    const host = new URL(base).host;
    return [{ host, baseUrl: base, source: 'one-manga' }];
  }

  async queueStats(): Promise<QueueStats> {
    const counts = await this.queue.getJobCounts(
      'waiting',
      'active',
      'completed',
      'failed',
      'delayed',
      'paused',
    );
    return {
      waiting: counts.waiting ?? 0,
      active: counts.active ?? 0,
      completed: counts.completed ?? 0,
      failed: counts.failed ?? 0,
      delayed: counts.delayed ?? 0,
      paused: counts.paused ?? 0,
    };
  }

  async dbStats(): Promise<DbStats> {
    const [series, chapters, pages, extSeries, extChapters] = await Promise.all(
      [
        this.prisma.series.count({ where: { deletedAt: null } }),
        this.prisma.chapter.count({ where: { deletedAt: null } }),
        this.prisma.page.count({ where: { deletedAt: null } }),
        this.prisma.externalRef.count({
          where: { source: 'one-manga', entity: 'series' },
        }),
        this.prisma.externalRef.count({
          where: { source: 'one-manga', entity: 'chapter' },
        }),
      ],
    );
    return {
      series,
      chapters,
      pages,
      externalRefs: { series: extSeries, chapters: extChapters },
    };
  }

  async getAllHostsMetrics(): Promise<HostMetrics[]> {
    const hosts = this.listHosts();
    const [queue, db] = await Promise.all([this.queueStats(), this.dbStats()]);
    return hosts.map((h) => ({ ...h, queue, db }));
  }

  async getHostMetrics(host: string): Promise<HostMetrics> {
    const [info] = this.listHosts();
    if (!info || info.host !== host) {
      throw new Error('unknown_host');
    }
    const [queue, db] = await Promise.all([this.queueStats(), this.dbStats()]);
    return { ...info, queue, db };
  }
}
