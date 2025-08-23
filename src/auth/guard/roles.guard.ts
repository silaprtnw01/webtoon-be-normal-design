import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

type MaybeUser =
  | { sub?: string; id?: string; roles?: string[] | null }
  | undefined;

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    // 1) ดึง role ที่ประกาศไว้บน handler/class
    const required =
      this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
        ctx.getHandler(),
        ctx.getClass(),
      ]) ?? [];

    if (required.length === 0) return true;

    // 2) normalize เป็น lower-case ทั้งสองฝั่ง
    const req = ctx.switchToHttp().getRequest();
    const user = req.user as MaybeUser;
    const have = new Set(
      (user?.roles ?? []).map((r) => String(r).toLowerCase()),
    );
    const need = required.map((r) => r.toLowerCase());

    // 3) ถ้าไม่มี roles เลย ตัดจบ
    if (have.size === 0) return false;

    // 4) นโยบาย: ขอแค่ “มีสักหนึ่ง” role ก็พอ (เหมือนของเดิมที่ใช้ some)
    // ถ้าอยากเข้มขึ้นให้เปลี่ยนเป็น every() แทน
    return need.some((r) => have.has(r));
  }
}
