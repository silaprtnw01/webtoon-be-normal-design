import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { AppConfigModule } from './config/app-config.module';
import { StorageModule } from './storage/storage.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppConfigService } from './config/app-config.service';
import { ThrottlerStorageRedisService } from 'nestjs-throttler-storage-redis';
import { Redis } from 'ioredis';
import { CatalogModule } from './catalog/catalog.module';
import { CatalogService } from './catalog/catalog.service';
import { CrawlerModule } from './crawler/crawler.module';

@Module({
  imports: [
    PrismaModule,
    AppConfigModule,
    HealthModule,
    StorageModule,
    UsersModule,
    AuthModule,
    AdminModule,
    ThrottlerModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (cfg: AppConfigService) => ({
        throttlers: [{ ttl: 60_000, limit: 60 }],
        storage: new ThrottlerStorageRedisService(new Redis(cfg.redisUrl)),
      }),
    }),
    CatalogModule,
    CrawlerModule,
  ],
  controllers: [AppController],
  providers: [AppService, CatalogService],
})
export class AppModule {}
