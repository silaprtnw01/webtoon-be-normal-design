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
import { CreatePageDto, UpdatePageDto } from '../dto/page.dto';
import { JwtAuthGuard } from '../../auth/guard/jwt.guard';
import { Roles, RolesGuard } from '../../auth/roles/roles.guard';

@ApiTags('Catalog - Pages')
@Controller()
export class PagesController {
  constructor(private srv: CatalogService) {}

  // Public list pages in a chapter
  @Get('catalog/chapters/:chapterId/pages')
  @ApiOperation({ summary: 'List pages in a chapter (public)' })
  async list(@Param('chapterId') chapterId: string) {
    return { items: await this.srv.listPages(chapterId) };
  }

  // Admin CRUD
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Post('catalog/chapters/:chapterId/pages')
  @Roles('admin')
  @HttpCode(201)
  async create(
    @Param('chapterId') chapterId: string,
    @Body() dto: CreatePageDto,
  ) {
    return this.srv.createPage(chapterId, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Patch('catalog/pages/:id')
  @Roles('admin')
  async update(@Param('id') id: string, @Body() dto: UpdatePageDto) {
    return this.srv.updatePage(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Delete('catalog/pages/:id')
  @Roles('admin')
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    await this.srv.softDeletePage(id);
  }
}
