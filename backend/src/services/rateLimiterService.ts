import { redisConnection, getIsRedisConnected } from '../config/redis';

// In-memory fallback counters when Redis is unavailable
const inMemoryCounters = new Map<string, { count: number; expiresAt: number }>();

export function getHourWindowKey(senderId: string, date = new Date()): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const hh = String(date.getUTCHours()).padStart(2, '0');
  return `rate_limit:${senderId}:${yyyy}-${mm}-${dd}-${hh}`;
}

export function getMsUntilNextHourWindow(): number {
  const now = new Date();
  const nextHour = new Date(now);
  nextHour.setUTCHours(now.getUTCHours() + 1, 0, 0, 0);
  return nextHour.getTime() - now.getTime();
}

async function checkWithRedis(
  key: string,
  limit: number
): Promise<{ allowed: boolean; currentCount: number; msUntilNextWindow: number }> {
  const count = await redisConnection.incr(key);

  if (count === 1) {
    await redisConnection.expire(key, 7200);
  }

  if (count > limit) {
    await redisConnection.decr(key);
    const msUntilNextWindow = getMsUntilNextHourWindow();
    return {
      allowed: false,
      currentCount: count - 1,
      msUntilNextWindow: msUntilNextWindow > 0 ? msUntilNextWindow : 60000,
    };
  }

  return { allowed: true, currentCount: count, msUntilNextWindow: 0 };
}

function checkWithInMemory(
  key: string,
  limit: number
): { allowed: boolean; currentCount: number; msUntilNextWindow: number } {
  const now = Date.now();
  const entry = inMemoryCounters.get(key);

  if (!entry || entry.expiresAt < now) {
    // Create new window (expires in 2 hours)
    inMemoryCounters.set(key, { count: 1, expiresAt: now + 7200000 });
    return { allowed: true, currentCount: 1, msUntilNextWindow: 0 };
  }

  entry.count++;

  if (entry.count > limit) {
    entry.count--;
    const msUntilNextWindow = getMsUntilNextHourWindow();
    return {
      allowed: false,
      currentCount: entry.count,
      msUntilNextWindow: msUntilNextWindow > 0 ? msUntilNextWindow : 60000,
    };
  }

  return { allowed: true, currentCount: entry.count, msUntilNextWindow: 0 };
}

export async function checkAndIncrementRateLimit(
  senderId: string,
  limit: number
): Promise<{ allowed: boolean; currentCount: number; msUntilNextWindow: number }> {
  const key = getHourWindowKey(senderId);

  if (getIsRedisConnected()) {
    try {
      return await checkWithRedis(key, limit);
    } catch {
      // Redis call failed mid-flight, fall through to in-memory
    }
  }

  return checkWithInMemory(key, limit);
}
