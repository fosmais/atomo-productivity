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
    const missing = [
      !redisUrl ? "UPSTASH_REDIS_REST_URL" : null,
      !redisToken ? "UPSTASH_REDIS_REST_TOKEN" : null,
    ].filter(Boolean);
    // Only variable names are logged; never log credentials or user identifiers.
    console.error("[MYKA] Rate limit indisponível: variáveis ausentes:", missing.join(", ") || "configuração inválida");
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