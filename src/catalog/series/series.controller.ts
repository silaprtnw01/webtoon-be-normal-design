import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CatalogService } from '../catalog.service';
import { CreateSeriesDto, UpdateSeriesDto } from '../dto/series.dto';
import { CursorQueryDto } from '../dto/query.dto';
import { JwtAuthGuard } from '../../auth/guard/jwt.guard';
import { Roles } from '../../auth/guard/roles.guard';
import type { Request } from 'express';
import { RolesGuard } from '../../auth/roles/roles.guard';

@ApiTags('Catalog - Series')
@Controller('catalog/series')
export class SeriesController {
  constructor(private srv: CatalogService) {}

  // Public list (published only by default)
  @Get()
  @ApiOperation({
    summary: 'List series (public)',
    description: 'คืนเฉพาะ published โดยค่าเริ่มต้น',
  })
  async list(@Query() q: CursorQueryDto) {
    const take = q.take ?? 20;
    const publishedOnly = q.publishedOnly !== 'false';
    const rows = await this.srv.listSeries(publishedOnly, take, q.cursor);
    return {
      items: rows,
      nextCursor: rows.length > 0 ? rows[rows.length - 1].id : null,
    };
  }

  // Public detail by slug (published only)
  @Get(':slug')
  @ApiOperation({ summary: 'Get series by slug (public)' })
  async bySlug(@Param('slug') slug: string) {
    return this.srv.getSeriesBySlug(slug);
  }

  // Admin: create/update/delete
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Post()
  @Roles('admin')
  @HttpCode(201)
  @ApiOkResponse()
  async create(
    @Body() dto: CreateSeriesDto,
    @Req() req: Request & { user: { sub: string } },
  ) {
    const user = req.user;
    return this.srv.createSeries({ ...dto, createdBy: user.sub });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Patch(':id')
  @Roles('admin')
  async update(@Param('id') id: string, @Body() dto: UpdateSeriesDto) {
    return this.srv.updateSeries(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Delete(':id')
  @Roles('admin')
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    await this.srv.softDeleteSeries(id);
  }
}
