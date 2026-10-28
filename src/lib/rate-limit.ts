import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

const redis =
  redisUrl && redisToken
    ? new Redis({
        url: redisUrl,
        token: redisToken,
      })
    : null;

const minuteLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, "1 m"),
      prefix: "vyra:concierge:minute",
      analytics: false,
    })
  : null;

const dailyLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(100, "1 d"),
      prefix: "vyra:concierge:daily",
      analytics: false,
    })
  : null;

export async function checkConciergeRateLimit(userId: string) {
  if (!minuteLimiter || !dailyLimiter) {
    throw new Error("Rate limiting não configurado.");
  }

  const minute = await minuteLimiter.limit(userId);

  if (!minute.success) {
    return {
      allowed: false,
      reset: minute.reset,
    };
  }

  const daily = await dailyLimiter.limit(userId);

  if (!daily.success) {
    return {
      allowed: false,
      reset: daily.reset,
    };
  }

  return {
    allowed: true,
    reset: Math.max(minute.reset, daily.reset),
  };
}