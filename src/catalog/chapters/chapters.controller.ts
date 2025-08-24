import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CatalogService } from '../catalog.service';
import { CreateChapterDto, UpdateChapterDto } from '../dto/chapter.dto';
import { JwtAuthGuard } from 'src/auth/guard/jwt.guard';
import { Roles } from 'src/auth/roles/roles.guard';

@ApiTags('Catalog - Chapters')
@Controller()
export class ChaptersController {
  constructor(private srv: CatalogService) {}

  // Public list
  @Get('catalog/series/:seriesId/chapters')
  @ApiOperation({
    summary: 'List chapters by series (public)',
    description: 'คืนเฉพาะ published',
  })
  async list(@Param('seriesId') seriesId: string) {
    return { items: await this.srv.listChapters(seriesId, true) };
  }

  // Admin: create/update/delete
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('catalog/series/:seriesId/chapters')
  @Roles('admin')
  @HttpCode(201)
  async create(
    @Param('seriesId') seriesId: string,
    @Body() dto: CreateChapterDto,
  ) {
    return this.srv.createChapter(seriesId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Patch('catalog/chapters/:id')
  @Roles('admin')
  async update(@Param('id') id: string, @Body() dto: UpdateChapterDto) {
    return this.srv.updateChapter(id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Delete('catalog/chapters/:id')
  @Roles('admin')
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    await this.srv.softDeleteChapter(id);
  }
}
