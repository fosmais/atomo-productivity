import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const headers = { "Cache-Control": "no-store" };
/**
 * Receive signed Mercado Pago notifications for audit/idempotency.
 * Never grant paid entitlements here: a separate verified reconciliation
 * must retrieve subscription state directly from the provider.
 */
export async function POST(request: Request) {
  if (process.env.BILLING_CHECKOUT_ENABLED !== "true") {
    return NextResponse.json({ error: "Webhook desabilitado." }, { status: 503, headers });
  }
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  const signature = request.headers.get("x-signature") || "";
  const requestId = request.headers.get("x-request-id") || "";
  const resourceId = new URL(request.url).searchParams.get("data.id") || "";
  const ts = signature.match(/(?:^|,)\s*ts=([^,]+)/)?.[1];
  const v1 = signature.match(/(?:^|,)\s*v1=([a-f0-9]{64})(?:,|$)/i)?.[1];
  if (!secret || !requestId || !resourceId || !ts || !/^\d+$/.test(ts) || !v1) {
    return NextResponse.json({ error: "Assinatura inválida." }, { status: 401, headers });
  }
  if (Math.abs(Date.now() - Number(ts) * 1000) > 5 * 60 * 1000) {
    return NextResponse.json({ error: "Notificação expirada." }, { status: 401, headers });
  }
  const manifest = `id:${resourceId.toLowerCase()};request-id:${requestId};ts:${ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest();
  const received = Buffer.from(v1, "hex");
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return NextResponse.json({ error: "Assinatura inválida." }, { status: 401, headers });
  }
  const type = new URL(request.url).searchParams.get("type") || "unknown";
  const { error } = await createSupabaseAdmin().from("billing_webhook_events").upsert({
    provider: "mercadopago",
    provider_event_id: `${type}:${resourceId}`,
    event_type: type,
  }, { onConflict: "provider,provider_event_id", ignoreDuplicates: true });
  if (error) return NextResponse.json({ error: "Falha ao registrar notificação." }, { status: 503, headers });
  return NextResponse.json({ received: true, entitlementGranted: false }, { headers });
}
