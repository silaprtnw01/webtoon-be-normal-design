import * as cheerio from 'cheerio';

export class MadaraAdapter {
  constructor(private base: string) {}

  listingUrl(page: number) {
    return `${this.base}/manga/${page > 1 ? `page/${page}/` : ''}`;
  }

  // ดึงลิงก์ series จากหน้ารายการ
  parseListing(html: string): string[] {
    const $ = cheerio.load(html);
    // เลือก a ที่มีข้อความ "อ่านเรื่องนี้" หรือ href ที่ขึ้นต้น /manga/ (ไม่เอา /manga/page/)
    const urls = new Set<string>();
    $('a').each((_, a) => {
      const href = ($(a).attr('href') || '').trim();
      const txt = ($(a).text() || '').trim();
      if (!href) return;
      const okByText = /อ่านเรื่องนี้/i.test(txt);
      const okByHref =
        /^https?:\/\/|^\//.test(href) &&
        /\/manga\//.test(href) &&
        !/\/manga\/page\//.test(href) &&
        !/-\d+\/$/.test(href);
      if (okByText || okByHref) {
        const u = this.abs(href);
        // กรองเฉพาะหน้า series (ไม่มี -{number} ต่อท้าย)
        if (!/-\d+(?:\.\d+)?\/?$/.test(u)) urls.add(this.clean(u));
      }
    });
    return [...urls];
  }

  // ดึงข้อมูลจากหน้า series: slug, title, ลิสต์ตอน
  parseSeriesPage(
    url: string,
    html: string,
  ): {
    slug: string;
    title: string;
    description?: string;
    chapters: { url: string }[];
  } {
    const $ = cheerio.load(html);
    const title = ($('h1').first().text() || '').trim() || 'untitled';
    // รวม text จาก tag p ทั้งหมดใน div.entry-content.entry-content-single
    let description: string | undefined = '';
    const paragraphs: string[] = [];

    // ดึง p tags ทั้งหมดจาก div.entry-content.entry-content-single
    $('div.entry-content.entry-content-single p').each((_, p) => {
      const text = $(p).text().trim();
      if (text && text.length > 10) {
        // กรองข้อความสั้นๆ
        paragraphs.push(text);
      }
    });

    // หากไม่เจอ ลองแบบไม่มี class entry-content-single
    if (paragraphs.length === 0) {
      $('div.entry-content p').each((_, p) => {
        const text = $(p).text().trim();
        if (text && text.length > 10) {
          paragraphs.push(text);
        }
      });
    }

    // รวม paragraphs ทั้งหมดด้วย double line break
    if (paragraphs.length > 0) {
      description = paragraphs.join('\n\n');
    }

    // ถ้าไม่มี description หรือสั้นเกินไป ให้เป็น undefined
    if (!description || description.length < 20) {
      description = undefined;
    }
    const slug = this.seriesSlugFromUrl(url);
    const chapters: { url: string }[] = [];
    $('a').each((_, a) => {
      const href = ($(a).attr('href') || '').trim();
      if (!href) return;
      const u = this.abs(href);
      // เลือกเฉพาะลิงก์ตอน เช่น /manga/<slug>-141/
      if (new RegExp(`/manga/${slug}-\\d`).test(u)) {
        chapters.push({ url: this.clean(u) });
      }
    });
    // unique & เรียงจากน้อยไปมาก (ดึงเลขตอนจาก URL)
    const uniq = new Map<number, string>();
    chapters.forEach((c) => {
      const num = this.chapterNumberFromUrl(c.url);
      if (num !== null && !uniq.has(num)) uniq.set(num, c.url);
    });
    const sorted = [...uniq.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, u]) => ({ url: u }));
    return { slug, title, description, chapters: sorted };
  }

  // ดึงข้อมูลจากหน้าตอน: seriesSlug, number, title?, images[]
  parseChapterPage(
    url: string,
    html: string,
  ): {
    seriesSlug: string;
    number: number;
    title?: string;
    images: string[];
  } {
    const $ = cheerio.load(html);
    const seriesSlug = this.seriesSlugFromChapterUrl(url);
    const num = this.chapterNumberFromUrl(url) ?? Number.MAX_SAFE_INTEGER;
    const titleTxt = $('h1').first().text().trim();
    const images: string[] = [];
    $('img').each((_, img) => {
      const attrs = ['data-src', 'data-lazy-src', 'src', 'data-original'];
      for (const k of attrs) {
        const v = ($(img).attr(k) || '').trim();
        if (v) {
          const u = this.abs(v);
          // เลือกเฉพาะไฟล์ภาพทั่วไป
          if (/\.(webp|jpg|jpeg|png)(\?.*)?$/i.test(u))
            images.push(this.clean(u));
          break;
        }
      }
    });
    // uniq ตามลำดับ
    const out: string[] = [];
    const seen = new Set<string>();
    for (const u of images)
      if (!seen.has(u)) {
        out.push(u);
        seen.add(u);
      }
    return {
      seriesSlug,
      number: num,
      title: titleTxt,
      images: out,
    };
  }

  // ---------- helpers ----------
  private abs(href: string) {
    if (/^https?:\/\//i.test(href)) return href;
    return `${this.base}${href.startsWith('/') ? '' : '/'}${href}`;
  }
  private clean(u: string) {
    // ลบ query/fragment
    return u.split('#')[0];
  }
  private seriesSlugFromUrl(u: string) {
    // ตัวอย่าง: https://one-manga.com/manga/manga/i-became-the-tyrant-of-a-defense-game/
    const path = new URL(u).pathname.replace(/\/+$/, '');
    const parts = path.split('/').filter(Boolean);
    // หา segment สุดท้ายที่ไม่ใช่ "manga"
    for (let i = parts.length - 1; i >= 0; i--) {
      if (parts[i] !== 'manga') return parts[i];
    }
    return parts[parts.length - 1] || 'series';
  }
  private seriesSlugFromChapterUrl(u: string) {
    // https://one-manga.com/manga/i-became-the-tyrant-of-a-defense-game-141/
    const base = new URL(u).pathname.split('/').filter(Boolean).pop() || '';
    return base.replace(/-\d+(?:\.\d+)?$/, '');
  }
  private chapterNumberFromUrl(u: string): number | null {
    const m = /-(\d+(?:\.\d+)?)\/?$/.exec(new URL(u).pathname);
    if (!m) return null;
    return Number(m[1]);
  }
}
