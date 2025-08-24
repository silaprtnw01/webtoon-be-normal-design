import { Module } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { SeriesController } from './series/series.controller';
import { ChaptersController } from './chapters/chapters.controller';
import { PagesController } from './pages/pages.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AppConfigModule } from '../config/app-config.module';

@Module({
  imports: [PrismaModule, AppConfigModule],
  controllers: [SeriesController, ChaptersController, PagesController],
  providers: [CatalogService],
})
export class CatalogModule {}
