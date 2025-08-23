import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guard/jwt.guard';
import { Roles, RolesGuard } from '../auth/roles/roles.guard';
import { OkResponseDto } from '../auth/dto/ok.dto';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin')
export class AdminController {
  @Get('ping')
  @Roles('admin')
  @ApiOperation({ summary: 'Admin ping (RBAC: admin only)' })
  @ApiOkResponse({ type: OkResponseDto })
  ping() {
    return { ok: true, role: 'admin' };
  }
}
