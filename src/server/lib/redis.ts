import Redis from 'ioredis';
import 'dotenv/config';

let redisInstance: Redis | null = null;

export function getRedis(): Redis {
  if (!redisInstance) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    redisInstance = new Redis(redisUrl, {
      maxRetriesPerRequest: null, // Required by BullMQ
      enableReadyCheck: false,
      retryStrategy(times) {
        const delay = Math.min(times * 200, 5000);
        return delay;
      },
    });

    redisInstance.on('connect', () => {
      console.log('[INFO] Redis connected');
    });

    redisInstance.on('error', (err) => {
      console.error('[ERROR] Redis connection error:', err.message);
    });
  }
  return redisInstance;
}

export async function closeRedis(): Promise<void> {
  if (redisInstance) {
    await redisInstance.quit();
    redisInstance = null;
  }
}
