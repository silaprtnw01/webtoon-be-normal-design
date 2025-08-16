import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { AppConfigService } from './app-config.service';

type Pkg = { name?: string; version?: string };

@Injectable()
export class AppInfoService {
  private cached?: { name: string; version: string };

  constructor(private readonly config: AppConfigService) {}

  private readPackageJson(): Pkg {
    const candidates = [
      path.join(process.cwd(), 'package.json'),
      path.resolve(__dirname, '../../package.json'),
      path.resolve(__dirname, '../package.json'),
    ];
    for (const p of candidates) {
      try {
        if (fs.existsSync(p)) {
          const raw = fs.readFileSync(p, 'utf8');
          return JSON.parse(raw) as Pkg;
        }
      } catch {
        /* ignore and try next */
      }
    }
    return {};
  }

  getInfo() {
    if (!this.cached) {
      const pkg = this.readPackageJson();
      this.cached = {
        name: pkg.name ?? 'webtoon-platform',
        version: pkg.version ?? '0.0.0',
      };
    }
    return {
      ...this.cached,
      nodeEnv: this.config.nodeEnv,
    };
  }
}
