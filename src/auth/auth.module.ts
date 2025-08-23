import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { AppConfigModule } from '../config/app-config.module';
import { JwtStrategy } from './strategy/jwt.strategy';
import { RolesGuard } from './roles/roles.guard';
import { PrismaModule } from '../prisma/prisma.module';

import { APP_GUARD } from '@nestjs/core';
import { GoogleStrategy } from './strategy/google.strategy';
import { ThrottlerGuard } from '@nestjs/throttler';

@Module({
  imports: [
    UsersModule,
    PrismaModule,
    AppConfigModule,
    PassportModule,
    JwtModule.register({}),
  ],
  providers: [
    AuthService,
    JwtStrategy,
    RolesGuard,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    GoogleStrategy,
  ],
  controllers: [AuthController],
})
export class AuthModule {}
