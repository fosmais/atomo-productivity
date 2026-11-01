import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { asaasSandboxReady } from "@/lib/billing/asaas";
import { isReconciliationEvent, readAsaasPaymentReference } from "@/lib/billing/asaas-events";

const headers = { "Cache-Control": "no-store" };
export async function POST(request: Request) {
  if (!asaasSandboxReady()) return NextResponse.json({ error: "Webhook desabilitado." }, { status: 503, headers });
  const expected = Buffer.from(process.env.ASAAS_WEBHOOK_TOKEN!);
  const supplied = Buffer.from(request.headers.get("asaas-access-token") || "");
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401, headers });
  }
  const maxBytes = 32768;
  const reader = request.body?.getReader();
  if (!reader) return NextResponse.json({ error: "Corpo ausente." }, { status: 400, headers });
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return NextResponse.json({ error: "Evento muito grande." }, { status: 413, headers });
      }
      chunks.push(value);
    }
  } catch {
    return NextResponse.json({ error: "Falha ao ler evento." }, { status: 400, headers });
  }
  const raw = Buffer.concat(chunks, total).toString("utf8");
  let data: unknown;
  try { data = JSON.parse(raw); } catch { return NextResponse.json({ error: "JSON inválido." }, { status: 400, headers }); }
  if (!data || typeof data !== "object") return NextResponse.json({ error: "Evento inválido." }, { status: 400, headers });
  const event = data as Record<string, unknown>;
  if (typeof event.id !== "string" || !/^[\w-]{1,128}$/.test(event.id) ||
      typeof event.event !== "string" || !/^[A-Z_]{1,100}$/.test(event.event)) {
    return NextResponse.json({ error: "Evento inválido." }, { status: 400, headers });
  }
  const admin = createSupabaseAdmin();
  const { error } = await admin.from("billing_webhook_events").upsert({
    provider: "asaas", provider_event_id: event.id, event_type: event.event,
  }, { onConflict: "provider,provider_event_id", ignoreDuplicates: true });
  if (error) return NextResponse.json({ error: "Falha ao persistir evento." }, { status: 503, headers });
  // Queue ingestion is separately gated until the reviewed SQL migrations exist.
  // Missing payment references must not silently acknowledge eligible events.
  if (process.env.ASAAS_RECONCILIATION_QUEUE_ENABLED === "true" && isReconciliationEvent(event.event)) {
    const paymentId = readAsaasPaymentReference(event);
    if (!paymentId) {
      return NextResponse.json({ error: "Referência de pagamento ausente." }, { status: 422, headers });
    }
    const { data: jobId, error: queueError } = await admin.rpc("enqueue_asaas_reconciliation_event", {
      p_event_id: event.id,
      p_event_type: event.event,
      p_payment_id: paymentId,
    });
    if (queueError || typeof jobId !== "number") {
      // 503 requests a provider retry; the audit receipt is already idempotent.
      return NextResponse.json({ error: "Fila indisponível." }, { status: 503, headers });
    }
  }
  // Acknowledgement is never payment confirmation or an entitlement grant.
  return NextResponse.json({ received: true, entitlementGranted: false }, { headers });
}
