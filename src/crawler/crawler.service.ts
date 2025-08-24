import { Injectable, Logger } from '@nestjs/common';
import { Queue, Worker, JobsOptions } from 'bullmq';
import IORedis from 'ioredis';
import got from 'got';
import { PrismaService } from '../prisma/prisma.service';
import { AppConfigService } from '../config/app-config.service';
import { MadaraAdapter } from './adapters/madara.adapter';

type JobData =
  | { type: 'SERIES_PAGE'; url: string }
  | { type: 'CHAPTER_PAGE'; url: string };

@Injectable()
export class CrawlerService {
  private queue: Queue<JobData>;
  private worker?: Worker<JobData>;
  private redis: IORedis;
  private metrics = { enqueued: 0, processed: 0, failed: 0, lastError: '' };

  constructor(
    private prisma: PrismaService,
    private cfg: AppConfigService,
    private log: Logger,
  ) {
    this.redis = new IORedis(this.cfg.redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
    this.queue = new Queue<JobData>('crawler-one-manga', {
      connection: this.redis,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      } as JobsOptions,
    });
  }

  async startWorker() {
    const { base, concurrency, rate, ua } = this.cfg.crawler;
    const adapter = new MadaraAdapter(base);

    this.worker = new Worker<JobData>(
      'crawler-one-manga',
      async (job) => {
        const t0 = Date.now();
        try {
          if (job.data.type === 'SERIES_PAGE') {
            const html = await this.httpGet(job.data.url, ua);
            const info = adapter.parseSeriesPage(job.data.url, html); // {slug,title,chapters[]}
            this.log.debug(
              `[crawler] Series ${info.slug}: title="${info.title}", description="${info.description || 'N/A'}"`,
            );
            const series = await this.upsertSeries(
              info.slug,
              info.title,
              info.description,
            );
            // bind external
            await this.prisma.externalRef.upsert({
              where: {
                source_entity_sourceKey: {
                  source: 'one-manga',
                  entity: 'series',
                  sourceKey: info.slug,
                },
              },
              update: { seriesId: series.id },
              create: {
                source: 'one-manga',
                entity: 'series',
                sourceKey: info.slug,
                seriesId: series.id,
              },
            });
            // enqueue chapters (dedup by jobId=url)
            await this.queue.addBulk(
              info.chapters.map((ch) => ({
                name: 'CHAPTER_PAGE',
                data: { type: 'CHAPTER_PAGE', url: ch.url },
                opts: { jobId: ch.url },
              })),
            );
            this.log.log(
              `[crawler] SERIES ${info.slug} -> enq ${info.chapters.length} chapters`,
            );
          } else if (job.data.type === 'CHAPTER_PAGE') {
            const html = await this.httpGet(job.data.url, ua);
            const parsed = adapter.parseChapterPage(job.data.url, html); // {seriesSlug, number, images[]}
            const series = await this.prisma.series.findUnique({
              where: { slug: parsed.seriesSlug },
            });
            if (!series)
              throw new Error(`series_not_found:${parsed.seriesSlug}`);
            const chapter = await this.prisma.chapter.upsert({
              where: {
                seriesId_number: { seriesId: series.id, number: parsed.number },
              },
              update: { status: 'published' as any },
              create: {
                seriesId: series.id,
                number: parsed.number,
                title: parsed.title ?? null,
                status: 'published' as any,
              },
            });
            await this.prisma.externalRef.upsert({
              where: {
                source_entity_sourceKey: {
                  source: 'one-manga',
                  entity: 'chapter',
                  sourceKey: `${parsed.seriesSlug}-${parsed.number}`,
                },
              },
              update: { chapterId: chapter.id },
              create: {
                source: 'one-manga',
                entity: 'chapter',
                sourceKey: `${parsed.seriesSlug}-${parsed.number}`,
                chapterId: chapter.id,
              },
            });
            for (let i = 0; i < parsed.images.length; i++) {
              await this.prisma.page.upsert({
                where: {
                  chapterId_index: { chapterId: chapter.id, index: i + 1 },
                },
                update: { imageKey: parsed.images[i] },
                create: {
                  chapterId: chapter.id,
                  index: i + 1,
                  imageKey: parsed.images[i],
                },
              });
            }
            this.log.log(
              `[crawler] CHAPTER ${parsed.seriesSlug}#${parsed.number} -> ${parsed.images.length} pages`,
            );
          }
          this.metrics.processed++;
          this.log.debug(
            `[crawler] ${job.data.type} OK in ${Date.now() - t0}ms`,
          );
        } catch (e: any) {
          this.metrics.failed++;
          this.metrics.lastError = e?.message ?? String(e);
          this.log.error(
            `[crawler] ${job.data.type} FAIL: ${this.metrics.lastError}`,
          );
          throw e;
        }
      },
      {
        connection: this.redis,
        concurrency: concurrency,
        limiter: { max: rate.max, duration: rate.duration },
      },
    );
    this.worker.on('failed', (job, err) =>
      this.log.error(`[crawler] job ${job?.id} failed: ${err?.message}`),
    );

    await this.worker.waitUntilReady();
  }

  private async httpGet(url: string, ua: string) {
    return got(url, {
      headers: { 'user-agent': ua, accept: 'text/html,application/xhtml+xml' },
      timeout: { request: 20_000 },
      retry: {
        limit: 2,
        methods: ['GET'],
        statusCodes: [408, 429, 500, 502, 503, 504],
      },
    }).text();
  }

  private async upsertSeries(
    slug: string,
    title: string,
    description?: string,
  ) {
    return this.prisma.series.upsert({
      where: { slug },
      update: { title, description, status: 'published' as any },
      create: { slug, title, description, status: 'published' as any },
    });
  }

  // ---- Public API ----
  async enqueueSeries(url: string) {
    await this.queue.add(
      'SERIES_PAGE',
      { type: 'SERIES_PAGE', url },
      { jobId: url },
    ); // dedup by URL
    this.metrics.enqueued++;
  }

  async getMetrics() {
    const [waiting, active, failed, completed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getFailedCount(),
      this.queue.getCompletedCount(),
    ]);
    return {
      queue: { waiting, active, failed, completed },
      counters: this.metrics,
    };
  }
}
