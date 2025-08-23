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
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import type { Request, Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { JwtService } from '@nestjs/jwt';
import { AppConfigService } from '../config/app-config.service';
import { JwtAuthGuard } from './jwt.guard';
import { TooManyResponseDto } from './dto/too-many.dto';
import { AccessTokenResponseDto } from './dto/access-token.dto';
import { OkResponseDto } from './dto/ok.dto';
import { SessionsResponseDto } from './dto/session.dto';
import { MeResponseDto } from './dto/me.dto';
import { ProvidersResponseDto } from './dto/providers.dto';
//import { Throttle } from '@nestjs/throttler';

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
  @ApiOperation({
    summary: 'Register with email/password',
    description:
      'สร้างผู้ใช้ใหม่และตั้ง **refresh token** ใน **HttpOnly cookie** ชื่อ `refresh_token`',
  })
  @ApiOkResponse({ type: AccessTokenResponseDto })
  @ApiTooManyRequestsResponse({
    type: TooManyResponseDto,
    description: 'ถูกจำกัดอัตรา (เมื่อติดตั้ง/เปิด ThrottlerGuard)',
  })
  //@Throttle({ default: { limit: 5, ttl: 60000 } })
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
  @ApiOperation({
    summary: 'Login with email/password',
    description:
      'ออก **access token** (Bearer) และตั้ง **refresh cookie** (HttpOnly).',
  })
  @ApiOkResponse({ type: AccessTokenResponseDto })
  @ApiTooManyRequestsResponse({ type: TooManyResponseDto })
  //@Throttle({ default: { limit: 10, ttl: 60000 } })
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
  @ApiOperation({
    summary: 'Rotate refresh token',
    description:
      'อ่าน `refresh_token` จาก **HttpOnly cookie** → ออก access token ใหม่ + **หมุน refresh token** (rotation). ถ้าใช้ refresh เก่า → **reuse detection** → 401 และ revoke session.',
  })
  @ApiOkResponse({ type: AccessTokenResponseDto })
  @ApiTooManyRequestsResponse({ type: TooManyResponseDto })
  //@Throttle({ default: { limit: 20, ttl: 60000 } })
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
  @ApiOperation({
    summary: 'Logout current session',
    description:
      'พยายาม revoke session จาก refresh cookie (best-effort) แล้วล้าง cookie ออก',
  })
  @ApiOkResponse({ type: OkResponseDto })
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
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'List sessions',
    description:
      'เรียกด้วย **access token** (Bearer). ใช้ดูและจัดการอุปกรณ์ที่ล็อกอินอยู่',
  })
  @ApiOkResponse({ type: SessionsResponseDto })
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
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke a session' })
  @ApiOkResponse({ type: OkResponseDto })
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
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiOkResponse({ type: MeResponseDto })
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

  @UseGuards(JwtAuthGuard)
  @Post('sessions/revoke-others')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Revoke all other sessions',
    description:
      'ปิด session ทั้งหมด **ยกเว้น** session ปัจจุบัน (จาก access token ที่ใช้เรียก)',
  })
  @ApiOkResponse({ type: OkResponseDto })
  @HttpCode(200)
  async revokeOthers(@Req() req: Request) {
    const user = (req as any).user as { sub: string; sid: string };
    await this.auth.revokeOtherSessions(user.sub, user.sid, {
      ip: req.ip,
      ua: req.headers['user-agent'] as string,
    });
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get('providers')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'List linked OAuth providers',
    description: 'ตอนนี้อ่านอย่างเดียว (unlink จะทำทีหลัง)',
  })
  @ApiOkResponse({ type: ProvidersResponseDto })
  async providers(@Req() req: Request) {
    const user = (req as any).user as { sub: string };
    const providers = await this.auth.listProviders(user.sub);
    return { providers };
  }
}
