import Redis from 'ioredis';
import { env } from './env';

let isRedisConnected = false;
let redisLoggedOnce = false;

export const redisConnection = new Redis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  maxRetriesPerRequest: null,
  retryStrategy(times) {
    // Retry every 10 seconds, capped
    return Math.min(times * 2000, 10000);
  },
  lazyConnect: true, // Don't auto-connect; we call .connect() manually
});

redisConnection.on('connect', () => {
  isRedisConnected = true;
  redisLoggedOnce = false;
  console.log('[Redis] Connected to Redis server.');
});

redisConnection.on('error', (err) => {
  isRedisConnected = false;
  if (!redisLoggedOnce) {
    console.warn(`[Redis] Not available (${err.message}). Rate limiting uses in-memory fallback. BullMQ disabled.`);
    redisLoggedOnce = true;
  }
});

redisConnection.on('close', () => {
  isRedisConnected = false;
});

// Attempt connection in background, don't block startup
redisConnection.connect().catch(() => {
  // Silently handled by error event
});

export function getIsRedisConnected() {
  return isRedisConnected;
}
