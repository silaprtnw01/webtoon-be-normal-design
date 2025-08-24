import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CrawlerService } from './crawler.service';
import { JwtAuthGuard } from '../auth/guard/jwt.guard';
import { Roles, RolesGuard } from '../auth/roles/roles.guard';
import { SeriesUrlDto } from './dto/series-url.dto';

@ApiTags('Crawler')
@Controller('crawler')
export class CrawlerController {
  constructor(private svc: CrawlerService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles('admin')
  @Post('series')
  @HttpCode(202)
  @ApiOperation({ summary: 'Crawl a whole series (chapters + pages) by URL' })
  async crawlSeries(@Body() dto: SeriesUrlDto) {
    await this.svc.enqueueSeries(dto.url); // deep crawl (series -> chapters -> pages)
    return { ok: true, enqueued: 1, type: 'SERIES_PAGE' };
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Crawler metrics (queue counters)' })
  @ApiOkResponse()
  async metrics() {
    return this.svc.getMetrics();
  }
}
