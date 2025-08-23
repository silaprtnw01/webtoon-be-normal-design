import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function ensureRole(code: string) {
  return prisma.role.upsert({ where: { code }, update: {}, create: { code } });
}

async function assignAdminIfConfigured() {
  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();
  if (!adminEmail) return;
  const user = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!user) {
    console.log(`ℹ️ ADMIN_EMAIL set but user not found: ${adminEmail}`);
    return;
  }
  const adminRole = await prisma.role.findUnique({ where: { code: 'admin' } });
  if (!adminRole) return;
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: adminRole.id } },
    update: {},
    create: { userId: user.id, roleId: adminRole.id },
  });
  console.log(`✅ Granted admin to ${adminEmail}`);
}

async function main() {
  console.log('🔧 Seed start (Phase 1)');
  await prisma.$queryRaw`SELECT 1`;

  await ensureRole('user');
  await ensureRole('admin');

  await assignAdminIfConfigured();

  console.log('✅ Roles ready');
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log('🌱 Seed finished (noop)');
  })
  .catch(async (e) => {
    console.error('❌ Seed error:', e?.message ?? e);
    await prisma.$disconnect();
    process.exit(1);
  });
