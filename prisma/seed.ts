/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Seed start (Phase 0) — no data yet');
  // ตัวอย่าง ping DB
  await prisma.$queryRaw`SELECT 1`;
  console.log('✅ DB ping ok — schema still empty');
  // TODO(Phase 1): insert base roles/plans after schema exists
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
