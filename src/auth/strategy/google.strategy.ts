import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-google-oauth20';
import { AppConfigService } from '../../config/app-config.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(cfg: AppConfigService) {
    const g = cfg.google;
    super({
      clientID: g.clientId!,
      clientSecret: g.clientSecret!,
      callbackURL: g.callbackUrl!,
      scope: ['email', 'profile'],
      passReqToCallback: true,
    });
  }

  validate(
    _req: any,
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
  ) {
    // ส่งข้อมูลที่ต้องใช้ไปให้ controller ผ่าน req.user
    const email = profile.emails?.[0]?.value?.toLowerCase();
    return {
      provider: 'google',
      providerId: profile.id,
      email,
      displayName: profile.displayName || email || `g_${profile.id}`,
    };
  }
}
