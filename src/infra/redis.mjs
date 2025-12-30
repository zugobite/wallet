import Redis from "ioredis";

/**
 * Redis client configuration
 * Supports both simple host/port config and full URL
 */
const redisConfig = process.env.REDIS_URL
  ? process.env.REDIS_URL
  : {
      host: process.env.REDIS_HOST || "127.0.0.1",
      port: parseInt(process.env.REDIS_PORT || "6379", 10),
      password: process.env.REDIS_PASSWORD || undefined,
      db: parseInt(process.env.REDIS_DB || "0", 10),
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
    };

export const redis = new Redis(redisConfig);
