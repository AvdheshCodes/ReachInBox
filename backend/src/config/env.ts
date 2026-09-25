import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const env = {
  PORT: process.env.PORT || '5000',
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://reachinbox:reachinbox_password@localhost:5432/reachinbox_db?schema=public',
  REDIS_HOST: process.env.REDIS_HOST || 'localhost',
  REDIS_PORT: parseInt(process.env.REDIS_PORT || '6379', 10),
  WORKER_CONCURRENCY: parseInt(process.env.WORKER_CONCURRENCY || '5', 10),
  MIN_DELAY_BETWEEN_EMAILS_MS: parseInt(process.env.MIN_DELAY_BETWEEN_EMAILS_MS || '2000', 10),
  MAX_EMAILS_PER_HOUR: parseInt(process.env.MAX_EMAILS_PER_HOUR || '200', 10),
  JWT_SECRET: process.env.JWT_SECRET || 'reachinbox_jwt_secret_key_987654321',
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',
};
