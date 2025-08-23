import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import type { Request, Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
// import { Roles } from './roles.guard';
import { JwtService } from '@nestjs/jwt';
import { AppConfigService } from '../config/app-config.service';
import { JwtAuthGuard } from './jwt.guard';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private auth: AuthService,
    private jwt: JwtService,
    private cfg: AppConfigService,
  ) {}

  private setRefreshCookie(res: Response, token: string) {
    const opts = this.auth.cookieOptions();
    res.cookie('refresh_token', token, {
      ...opts,
      maxAge: this.cfg.jwt.refreshTtlDays * 24 * 60 * 60 * 1000,
    });
  }
  private clearRefreshCookie(res: Response) {
    const opts = this.auth.cookieOptions();
    res.clearCookie('refresh_token', { ...opts, maxAge: 0 });
  }

  @Post('register')
  @HttpCode(201)
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { access, refresh } = await this.auth.register(
      dto.email,
      dto.password,
      dto.displayName,
      {
        ip: req.ip,
        ua: req.headers['user-agent'] as string,
        deviceId: req.headers['x-device-id'] as string,
      },
    );
    this.setRefreshCookie(res, refresh);
    return { accessToken: access };
  }

  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { access, refresh } = await this.auth.login(dto.email, dto.password, {
      ip: req.ip,
      ua: req.headers['user-agent'] as string,
      deviceId: dto.deviceId ?? (req.headers['x-device-id'] as string),
    });
    this.setRefreshCookie(res, refresh);
    return { accessToken: access };
  }

  @Post('refresh')
  @ApiCookieAuth('refresh_token')
  @HttpCode(200)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const cookie = (req.cookies?.['refresh_token'] as string) || '';
    const { access, refresh } = await this.auth.refresh(cookie, {
      ip: req.ip,
      ua: req.headers['user-agent'] as string,
    });
    this.setRefreshCookie(res, refresh); // rotation
    return { accessToken: access };
  }

  @Post('logout')
  @ApiCookieAuth('refresh_token')
  @HttpCode(200)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    // ถ้ามี refresh cookie → ใช้มันถอด sid ออก (best effort)
    const cookie = (req.cookies?.['refresh_token'] as string) || '';
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; sid: string }>(
        cookie,
        {
          secret: this.cfg.jwt.refreshSecret,
        },
      );
      await this.auth.revokeSession(payload.sub, payload.sid, {
        ip: req.ip,
        ua: req.headers['user-agent'] as string,
      });
    } catch {
      /* ignore */
    }
    this.clearRefreshCookie(res);
    return { ok: true };
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('sessions')
  async sessions(@Req() req: Request) {
    type AccessUser = { sub: string; roles?: string[] };
    const user = (req as any).user as AccessUser;
    const rows = await this.auth['prisma'].session.findMany({
      where: { userId: user.sub },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        createdAt: true,
        lastUsedAt: true,
        revokedAt: true,
        ip: true,
        userAgent: true,
        deviceId: true,
      },
    });
    return rows;
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete('sessions/:id')
  async revoke(@Req() req: Request, @Param('id') id: string) {
    type AccessUser = { sub: string };
    const user = (req as any).user as AccessUser | undefined;
    await this.auth.revokeSession(user?.sub ?? '', id, {
      ip: (req as any).ip,
      ua: req.headers['user-agent'] as string,
    });
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get('/me')
  async me(@Req() req: Request) {
    type AccessUser = { sub: string };
    const user = (req as any).user as AccessUser;
    const profile = await this.auth['prisma'].user.findUnique({
      where: { id: user.sub },
      select: {
        id: true,
        email: true,
        displayName: true,
        externalCustomerId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    const roles = (
      await this.auth['prisma'].userRole.findMany({
        where: { userId: user.sub },
        include: { role: true },
      })
    ).map((r) => r.role.code);
    return { ...profile, roles };
  }

  // ---- Google OAuth ----
  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleStart() {
    /* passport redirect */
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const u = (req as any).user; // { provider, providerId, email, displayName }
    const { access, refresh } = await this.auth.googleLogin(
      {
        providerId: u.providerId,
        email: u.email,
        displayName: u.displayName,
      },
      {
        ip: req.ip,
        ua: req.headers['user-agent'] as string,
        deviceId: req.headers['x-device-id'] as string,
      },
    );
    this.setRefreshCookie(res, refresh);
    return { accessToken: access, method: 'google' };
  }
}
