import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { reconcileAsaasPaymentEvent } from "@/lib/billing/reconcile-asaas";

const headers = { "Cache-Control": "no-store" };

/** Internal, secret-protected manual retry. No billing entitlement changes. */
export async function POST(request: Request) {
  const secret = process.env.ASAAS_RECONCILIATION_SECRET;
  const supplied = request.headers.get("authorization");
  const expected = Buffer.from(`Bearer ${secret || ""}`, "utf8");
  const actual = Buffer.from(supplied || "", "utf8");
  if (!secret || secret.length < 24 || !supplied ||
      actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401, headers });
  }
  if (process.env.ASAAS_ENVIRONMENT !== "sandbox") {
    return NextResponse.json({ error: "Ambiente não autorizado." }, { status: 503, headers });
  }

  const admin = createSupabaseAdmin();
  const { data, error } = await admin.from("asaas_webhook_inbox")
    .select("event_id,attempts")
    .in("state", ["pending", "failed"])
    .lt("attempts", 5)
    .like("event_type", "PAYMENT_%")
    .order("received_at", { ascending: true })
    .limit(10);
  if (error) return NextResponse.json({ error: "Falha na consulta." }, { status: 503, headers });

  let verified = 0;
  let failed = 0;
  for (const event of data ?? []) {
    const { error: claimError, data: claim } = await admin.from("asaas_webhook_inbox")
      .update({ state: "processing", attempts: event.attempts + 1 })
      .eq("event_id", event.event_id)
      .in("state", ["pending", "failed"])
      .eq("attempts", event.attempts)
      .select("event_id")
      .maybeSingle();
    if (claimError || !claim) continue;
    try {
      await reconcileAsaasPaymentEvent(event.event_id);
      verified += 1;
    } catch {
      failed += 1;
      const { error: failureError } = await admin.from("asaas_webhook_inbox").update({
        state: "failed",
        last_error: "Falha de verificação no Asaas Sandbox.",
      }).eq("event_id", event.event_id).eq("state", "processing");
      if (failureError) return NextResponse.json({ error: "Falha ao registrar tentativa." }, { status: 503, headers });
    }
  }
  return NextResponse.json({ scanned: (data ?? []).length, verified, failed }, { headers });
}
