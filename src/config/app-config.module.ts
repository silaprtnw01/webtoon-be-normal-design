import { Global, Module } from '@nestjs/common';
import { AppConfigService } from './app-config.service';
import { AppInfoService } from './app-info.service';

@Global()
@Module({
  providers: [AppConfigService, AppInfoService],
  exports: [AppConfigService, AppInfoService],
})
export class AppConfigModule {}
