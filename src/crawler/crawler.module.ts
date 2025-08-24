import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { CrawlerService } from './crawler.service';
import { CrawlerController } from './crawler.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AppConfigModule } from '../config/app-config.module';

@Module({
  imports: [PrismaModule, AppConfigModule],
  providers: [CrawlerService, Logger],
  controllers: [CrawlerController],
})
export class CrawlerModule implements OnModuleInit {
  constructor(private readonly svc: CrawlerService) {}
  async onModuleInit() {
    await this.svc.startWorker(); // เริ่ม worker ตอนบูต
  }
}
