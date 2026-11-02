import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/supabase/request-client";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { getUserEntitlements } from "@/lib/billing/entitlements";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { user, mfaRequired, assuranceUnavailable } = await authenticateRequest(request);
    if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    if (assuranceUnavailable) return NextResponse.json({ error: "Sessão indisponível." }, { status: 503 });
    if (mfaRequired) return NextResponse.json({ error: "Segundo fator obrigatório." }, { status: 403 });

    const dailyLimit = process.env.BILLING_ENTITLEMENTS_ENABLED === "true"
      ? (await getUserEntitlements(user.id)).aiMessagesPerDay : 10;

    // The Redis limiter uses a different store. Never misrepresent Supabase counts as its quota.
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
      return NextResponse.json({ available: false, dailyLimit }, { headers: { "Cache-Control": "no-store" } });
    }

    const now = new Date();
    const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const resetAt = dayStart.getTime() + 86400000;
    const { data, error } = await createSupabaseAdmin()
      .from("myka_usage_windows")
      .select("request_count")
      .eq("user_id", user.id)
      .eq("window_kind", "day")
      .eq("window_start", dayStart.toISOString())
      .maybeSingle();
    if (error) throw error;
    const used = Math.max(0, Number(data?.request_count ?? 0));
    return NextResponse.json({ available: true, dailyLimit, used, remaining: Math.max(0, dailyLimit - used), reached: used >= dailyLimit, resetAt }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Não foi possível consultar a cota." }, { status: 503 });
  }
}
