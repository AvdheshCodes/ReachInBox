import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

export async function connectDB() {
  try {
    await prisma.$connect();
    console.log('[PostgreSQL] Database connection established via Prisma');
  } catch (error) {
    console.error('[PostgreSQL] Database connection failed:', error);
    process.exit(1);
  }
}
