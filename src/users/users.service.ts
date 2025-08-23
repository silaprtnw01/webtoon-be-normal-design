import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as argon2 from 'argon2';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findByEmail(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    return user;
  }

  async create(email: string, password: string, displayName: string) {
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        displayName,
        roles: {
          // ใส่ role 'user' ทีหลังตอน seed ก็ได้; ตอนนี้ข้ามไป
        },
      },
    });
    return user;
  }
}
