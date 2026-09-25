import { PrismaClient } from '@prisma/client';

import { execSync } from 'child_process';

export const prisma = new PrismaClient();

export async function connectDB() {
  try {
    try {
      console.log('[Prisma] Ensuring database schema is synchronized...');
      execSync('npx prisma db push --accept-data-loss', { stdio: 'inherit' });
    } catch (pushErr: any) {
      console.warn('[Prisma] Auto schema push note:', pushErr?.message || pushErr);
    }
    await prisma.$connect();
    console.log('[Database] Connection established via Prisma');
  } catch (error) {
    console.error('[Database] Connection failed:', error);
    process.exit(1);
  }
}
