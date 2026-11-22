import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { getUserEntitlements } from "@/lib/billing/entitlements";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

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
  // When Redis is not configured, use an atomic, server-only Supabase quota.
  // Redis outages still fail closed to avoid switching quota stores mid-window.
  const billingEnabled = process.env.BILLING_ENTITLEMENTS_ENABLED === "true";
  const dailyLimit = billingEnabled ? (await getUserEntitlements(userId)).aiMessagesPerDay : 10;
  if (!minuteLimiter || !dailyLimiters) {
    const { data, error } = await createSupabaseAdmin().rpc("myka_check_usage", {
      p_user_id: userId,
      p_daily_limit: dailyLimit,
    });
    if (error || !data || typeof data.allowed !== "boolean" || typeof data.reset !== "number") {
      console.error("[MYKA] Limite de mensagens do Supabase indisponível.");
      throw new Error("Rate limiting indisponível.");
    }
    return { allowed: data.allowed, reset: data.reset, reason: data.allowed ? null : (data.reset <= Date.now() + 65000 ? "minute" as const : "daily" as const), dailyLimit };
  }
  const dailyLimiter = dailyLimiters.get(dailyLimit);
  if (!dailyLimiter) throw new Error("Limite diário não configurado.");

  const minute = await minuteLimiter.limit(userId);

  if (!minute.success) {
    return {
      allowed: false,
      reset: minute.reset,
      reason: "minute" as const,
      dailyLimit,
    };
  }

  const daily = await dailyLimiter.limit(userId);

  if (!daily.success) {
    return {
      allowed: false,
      reset: daily.reset,
      reason: "daily" as const,
      dailyLimit,
    };
  }

  return {
    allowed: true,
    reset: Math.max(minute.reset, daily.reset),
    reason: null,
    dailyLimit,
  };
}