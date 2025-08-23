import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { AppConfigService } from '../config/app-config.service';
import { addDays } from 'date-fns';

type IssueContext = { userId: string; sessionId: string; roles: string[] };

@Injectable()
export class AuthService {
  constructor(
    private users: UsersService,
    private prisma: PrismaService,
    private jwt: JwtService,
    private cfg: AppConfigService,
  ) {}

  private isUserWithPassword(
    value: unknown,
  ): value is { id: string; passwordHash: string } {
    return (
      typeof value === 'object' &&
      value !== null &&
      typeof (value as any).id === 'string' &&
      typeof (value as any).passwordHash === 'string'
    );
  }

  private async issueTokens(ctx: IssueContext) {
    const access = await this.jwt.signAsync(
      { sub: ctx.userId, sid: ctx.sessionId, roles: ctx.roles },
      {
        secret: this.cfg.jwt.accessSecret,
        expiresIn: this.cfg.jwt.accessTtlSec,
      },
    );
    // refresh jti row
    const jtiRow = await this.prisma.refreshToken.create({
      data: {
        sessionId: ctx.sessionId,
        expiresAt: addDays(new Date(), this.cfg.jwt.refreshTtlDays),
      },
    });
    const refresh = await this.jwt.signAsync(
      { sub: ctx.userId, sid: ctx.sessionId, jti: jtiRow.id },
      {
        secret: this.cfg.jwt.refreshSecret,
        expiresIn: `${this.cfg.jwt.refreshTtlDays}d`,
      },
    );
    return { access, refresh, jti: jtiRow.id };
  }

  cookieOptions() {
    const isProd = this.cfg.nodeEnv === 'production';
    return {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'strict' : 'lax',
      domain: this.cfg.cookieDomain,
      path: '/',
    } as const;
  }

  async register(
    email: string,
    password: string,
    displayName: string,
    client: { ip?: string; ua?: string; deviceId?: string },
  ) {
    const exists = await this.users.findByEmail(email);
    if (exists) throw new ForbiddenException('email_taken');
    const user = await this.users.create(email, password, displayName);

    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        ip: client.ip,
        userAgent: client.ua,
        deviceId: client.deviceId,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        sessionId: session.id,
        action: 'REGISTER',
        ip: client.ip,
        userAgent: client.ua,
      },
    });

    const roles = (
      await this.prisma.userRole.findMany({
        where: { userId: user.id },
        include: { role: true },
      })
    ).map((r) => r.role.code);
    return this.issueTokens({ userId: user.id, sessionId: session.id, roles });
  }

  async login(
    email: string,
    password: string,
    client: { ip?: string; ua?: string; deviceId?: string },
  ) {
    const user = await this.users.findByEmail(email);
    if (!this.isUserWithPassword(user)) {
      throw new UnauthorizedException('invalid_credentials');
    }
    const ok = await argon2.verify(user.passwordHash, password);
    if (!ok) throw new UnauthorizedException('invalid_credentials');

    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        ip: client.ip,
        userAgent: client.ua,
        deviceId: client.deviceId,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        sessionId: session.id,
        action: 'LOGIN',
        ip: client.ip,
        userAgent: client.ua,
      },
    });

    const roles = (
      await this.prisma.userRole.findMany({
        where: { userId: user.id },
        include: { role: true },
      })
    ).map((r) => r.role.code);
    return this.issueTokens({ userId: user.id, sessionId: session.id, roles });
  }

  async refresh(oldRefreshJwt: string, client: { ip?: string; ua?: string }) {
    let payload: any;
    try {
      payload = await this.jwt.verifyAsync(oldRefreshJwt, {
        secret: this.cfg.jwt.refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('invalid_refresh');
    }
    const {
      sub: userId,
      sid: sessionId,
      jti,
    } = payload as { sub: string; sid: string; jti: string };
    const tokenRow = await this.prisma.refreshToken.findUnique({
      where: { id: jti },
    });
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
    });

    // reuse detection
    if (!tokenRow || !session || session.revokedAt) {
      // ไม่มี token / session ถูก revoke → ถือเป็น reuse
      await this.prisma.session.updateMany({
        where: { id: sessionId },
        data: { revokedAt: new Date() },
      });
      await this.prisma.auditLog.create({
        data: {
          userId,
          sessionId,
          action: 'REFRESH_REUSE',
          ip: client.ip,
          userAgent: client.ua,
        },
      });
      throw new UnauthorizedException('refresh_reuse_detected');
    }
    if (tokenRow.rotatedAt || tokenRow.revokedAt) {
      // ใช้ซ้ำ
      await this.prisma.session.update({
        where: { id: sessionId },
        data: { revokedAt: new Date() },
      });
      await this.prisma.refreshToken.update({
        where: { id: jti },
        data: { reuseDetectedAt: new Date() },
      });
      await this.prisma.auditLog.create({
        data: {
          userId,
          sessionId,
          action: 'REFRESH_REUSE',
          ip: client.ip,
          userAgent: client.ua,
        },
      });
      throw new UnauthorizedException('refresh_reuse_detected');
    }
    if (tokenRow.expiresAt <= new Date()) {
      throw new UnauthorizedException('refresh_expired');
    }

    // mark rotated & issue new
    const roles = (
      await this.prisma.userRole.findMany({
        where: { userId },
        include: { role: true },
      })
    ).map((r) => r.role.code);
    const {
      access,
      refresh,
      jti: newJti,
    } = await this.issueTokens({ userId, sessionId, roles });
    await this.prisma.refreshToken.update({
      where: { id: jti },
      data: { rotatedAt: new Date(), replacedById: newJti },
    });

    await this.prisma.session.update({
      where: { id: sessionId },
      data: { lastUsedAt: new Date() },
    });
    await this.prisma.auditLog.create({
      data: {
        userId,
        sessionId,
        action: 'REFRESH',
        ip: client.ip,
        userAgent: client.ua,
      },
    });

    return { access, refresh };
  }

  async revokeSession(
    userId: string,
    sessionId: string,
    client: { ip?: string; ua?: string },
  ) {
    await this.prisma.session.updateMany({
      where: { id: sessionId, userId },
      data: { revokedAt: new Date() },
    });
    await this.prisma.auditLog.create({
      data: {
        userId,
        sessionId,
        action: 'REVOKE_SESSION',
        ip: client.ip,
        userAgent: client.ua,
      },
    });
  }
}
