import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { getUserEntitlements } from "@/lib/billing/entitlements";

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

// One shared namespace prevents quota resets when a user changes plans.
const legacyDailyLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(100, "1 d"),
      prefix: "vyra:concierge:daily",
      analytics: false,
    })
  : null;

const dailyLimiters = redis
  ? new Map(
      ([10, 100, 250] as const).map((limit) => [
        limit,
        new Ratelimit({
          redis,
          limiter: Ratelimit.fixedWindow(limit, "1 d"),
          prefix: "myryra:concierge:daily:v1",
          analytics: false,
        }),
      ])
    )
  : null;

export async function checkConciergeRateLimit(userId: string) {
  if (!minuteLimiter || !dailyLimiters || !legacyDailyLimiter) {
    const missing = [
      !redisUrl ? "UPSTASH_REDIS_REST_URL" : null,
      !redisToken ? "UPSTASH_REDIS_REST_TOKEN" : null,
    ].filter(Boolean);
    // Only variable names are logged; never log credentials or user identifiers.
    console.error("[MYKA] Rate limit indisponível: variáveis ausentes:", missing.join(", ") || "configuração inválida");
    throw new Error("Rate limiting não configurado.");
  }

  // Rollout guard: preserve the existing rate-limit behavior until the
  // billing migration and administrative credentials are verified.
  const billingEnabled = process.env.BILLING_ENTITLEMENTS_ENABLED === "true";
  const dailyLimit = billingEnabled
    ? (await getUserEntitlements(userId)).aiMessagesPerDay
    : 100;
  const dailyLimiter = billingEnabled ? dailyLimiters.get(dailyLimit) : legacyDailyLimiter;
  if (!dailyLimiter) throw new Error("Limite diário não configurado.");

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