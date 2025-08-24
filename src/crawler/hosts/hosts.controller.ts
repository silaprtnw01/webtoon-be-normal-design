import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { MetricsService } from '../metrics.service';
import { JwtAuthGuard } from '../../auth/guard/jwt.guard';
import { Roles, RolesGuard } from '../../auth/roles/roles.guard';

@ApiTags('Crawler - Hosts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('hosts')
export class HostsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get()
  @ApiOperation({ summary: 'List configured crawl hosts' })
  @ApiOkResponse()
  list() {
    return { hosts: this.metrics.listHosts() };
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Metrics for all hosts' })
  @ApiOkResponse()
  async allMetrics() {
    return { hosts: await this.metrics.getAllHostsMetrics() };
  }

  @Get(':host/metrics')
  @ApiOperation({ summary: 'Metrics for a specific host' })
  @ApiOkResponse()
  async hostMetrics(@Param('host') host: string) {
    return await this.metrics.getHostMetrics(host);
  }
}
