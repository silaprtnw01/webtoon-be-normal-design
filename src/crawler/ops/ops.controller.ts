import {
  Controller,
  Get,
  Query,
  Post,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { CrawlerService } from '../crawler.service';
import { JwtAuthGuard } from '../../auth/guard/jwt.guard';
import { Roles } from '../../auth/roles/roles.guard';

@ApiTags('Crawler - Ops')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Roles('admin')
@Controller('crawler')
export class CrawlerOpsController {
  constructor(private crawler: CrawlerService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Queue stats (รวม)' })
  async stats() {
    return this.crawler.jobStats();
  }

  @Get('jobs')
  @ApiOperation({ summary: 'List jobs by state' })
  @ApiQuery({
    name: 'state',
    required: true,
    enum: ['waiting', 'active', 'completed', 'failed', 'delayed'],
  })
  @ApiQuery({ name: 'start', required: false, example: 0 })
  @ApiQuery({ name: 'end', required: false, example: 49 })
  @ApiOkResponse({ description: 'รายการงานในคิว' })
  async jobs(
    @Query('state')
    state: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed',
    @Query('start') start = 0,
    @Query('end') end = 49,
  ) {
    return this.crawler.listJobs(state, Number(start), Number(end));
  }

  @Get('failed')
  @ApiOperation({ summary: 'List failed jobs' })
  @ApiOkResponse()
  async failed(@Query('start') start = 0, @Query('end') end = 49) {
    return this.crawler.listFailed(Number(start), Number(end));
  }

  @Post('retry/:id')
  @ApiOperation({ summary: 'Retry a failed job by id' })
  async retry(@Param('id') id: string) {
    return this.crawler.retryJob(id);
  }

  @Delete('remove/:id')
  @ApiOperation({ summary: 'Remove a job by id' })
  async remove(@Param('id') id: string) {
    return this.crawler.removeJob(id);
  }
}
