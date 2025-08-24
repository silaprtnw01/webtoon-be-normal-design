import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

@Injectable()
export class CatalogService {
  constructor(private prisma: PrismaService) {}

  // ---------- Series ----------
  async ensureSeriesSlugUnique(base: string) {
    let slug = slugify(base);
    if (!slug) slug = 'series';
    let i = 1;
    while (await this.prisma.series.findUnique({ where: { slug } })) {
      i += 1;
      slug = `${slugify(base)}-${i}`;
    }
    return slug;
  }

  async createSeries(data: {
    title: string;
    slug?: string;
    description?: string;
    status?: 'draft' | 'published';
    createdBy?: string;
  }) {
    const slug = data.slug
      ? await this.ensureSeriesSlugUnique(data.slug)
      : await this.ensureSeriesSlugUnique(data.title);
    return await this.prisma.series.create({
      data: {
        title: data.title,
        slug,
        description: data.description,
        status: (data.status ?? 'draft') as any,
        createdBy: data.createdBy ?? null,
      },
    });
  }

  async listSeries(publishedOnly = true, take = 20, cursor?: string) {
    return await this.prisma.series.findMany({
      where: {
        deletedAt: null,
        ...(publishedOnly ? { status: 'published' } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      select: {
        id: true,
        title: true,
        slug: true,
        description: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async getSeriesBySlug(slug: string) {
    const row = await this.prisma.series.findFirst({
      where: { slug, deletedAt: null, status: 'published' },
    });
    if (!row) throw new NotFoundException('series_not_found');
    return row;
  }

  async updateSeries(
    id: string,
    data: Partial<{
      title: string;
      slug: string;
      description: string;
      status: 'draft' | 'published';
    }>,
  ) {
    if (data.slug) {
      data.slug = await this.ensureSeriesSlugUnique(data.slug);
    }
    return await this.prisma.series.update({ where: { id }, data });
  }

  async softDeleteSeries(id: string) {
    await this.prisma.series.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  // ---------- Chapters ----------
  async ensureChapterSlug(seriesId: string, base?: string) {
    if (!base) return null;
    let s = slugify(base);
    if (!s) return null;
    let i = 1;
    while (
      await this.prisma.chapter.findFirst({ where: { seriesId, slug: s } })
    ) {
      i += 1;
      s = `${slugify(base)}-${i}`;
    }
    return s;
  }

  async createChapter(
    seriesId: string,
    data: {
      number: number;
      title?: string;
      slug?: string;
      status?: 'draft' | 'published';
      publishedAt?: Date | null;
    },
  ) {
    const slug = data.slug
      ? await this.ensureChapterSlug(seriesId, data.slug)
      : data.title
        ? await this.ensureChapterSlug(seriesId, data.title)
        : null;
    return await this.prisma.chapter.create({
      data: {
        seriesId,
        number: data.number,
        title: data.title ?? null,
        slug,
        status: (data.status ?? 'draft') as any,
        publishedAt: data.publishedAt ?? null,
      },
    });
  }

  async listChapters(seriesId: string, publishedOnly = true) {
    return await this.prisma.chapter.findMany({
      where: {
        seriesId,
        deletedAt: null,
        ...(publishedOnly ? { status: 'published' } : {}),
      },
      orderBy: [{ number: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        number: true,
        title: true,
        slug: true,
        status: true,
        publishedAt: true,
      },
    });
  }

  async updateChapter(
    id: string,
    data: Partial<{
      number: number;
      title: string;
      slug: string;
      status: 'draft' | 'published';
      publishedAt: Date | null;
    }>,
  ) {
    return await this.prisma.chapter.update({ where: { id }, data });
  }

  async softDeleteChapter(id: string) {
    await this.prisma.chapter.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  // ---------- Pages ----------
  async createPage(
    chapterId: string,
    data: {
      index: number;
      imageKey: string;
      width?: number | null;
      height?: number | null;
    },
  ) {
    return await this.prisma.page.create({
      data: {
        chapterId,
        index: data.index,
        imageKey: data.imageKey,
        width: data.width ?? null,
        height: data.height ?? null,
      },
    });
  }

  async listPages(chapterId: string) {
    return await this.prisma.page.findMany({
      where: { chapterId, deletedAt: null },
      orderBy: { index: 'asc' },
      select: {
        id: true,
        index: true,
        imageKey: true,
        width: true,
        height: true,
      },
    });
  }

  async updatePage(
    id: string,
    data: Partial<{
      index: number;
      imageKey: string;
      width: number | null;
      height: number | null;
    }>,
  ) {
    return await this.prisma.page.update({ where: { id }, data });
  }

  async softDeletePage(id: string) {
    await this.prisma.page.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
