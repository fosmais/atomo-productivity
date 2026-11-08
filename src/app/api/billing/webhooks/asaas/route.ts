import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const noStore = { "Cache-Control": "no-store" };

function matchesToken(provided: string | null, expected: string): boolean {
  if (!provided || !expected) return false;
  const actual = Buffer.from(provided, "utf8");
  const secret = Buffer.from(expected, "utf8");
  return actual.length === secret.length && timingSafeEqual(actual, secret);
}

/**
 * Asaas Sandbox webhook receiver (phase 1).
 * Fail closed until event persistence, idempotency and subscription reconciliation
 * are implemented. Never acknowledge a payment event before durable processing.
 */
export async function POST(request: Request) {
  if (process.env.ASAAS_ENVIRONMENT !== "sandbox" ||
      !process.env.ASAAS_WEBHOOK_TOKEN ||
      !process.env.ASAAS_API_KEY) {
    return NextResponse.json({ error: "Webhook indisponível." }, { status: 503, headers: noStore });
  }

  if (!matchesToken(request.headers.get("asaas-access-token"), process.env.ASAAS_WEBHOOK_TOKEN)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401, headers: noStore });
  }

  const contentLength = Number(request.headers.get("content-length") || "0");
  if (contentLength > 65536) {
    return NextResponse.json({ error: "Evento muito grande." }, { status: 413, headers: noStore });
  }

  let payload: unknown;
  try {
    const body = await request.text();
    if (Buffer.byteLength(body, "utf8") > 65536) {
      return NextResponse.json({ error: "Evento muito grande." }, { status: 413, headers: noStore });
    }
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400, headers: noStore });
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload) ||
      typeof (payload as Record<string, unknown>).id !== "string" ||
      typeof (payload as Record<string, unknown>).event !== "string") {
    return NextResponse.json({ error: "Evento inválido." }, { status: 400, headers: noStore });
  }

  const event = payload as Record<string, unknown>;
  const eventId = event.id as string;
  const eventType = event.event as string;
  if (eventId.length > 200 || eventType.length > 150) {
    return NextResponse.json({ error: "Evento inválido." }, { status: 400, headers: noStore });
  }

  try {
    const admin = createSupabaseAdmin();
    const { error } = await admin.from("asaas_webhook_inbox").upsert(
      { event_id: eventId, event_type: eventType, payload: event, state: "pending" },
      { onConflict: "event_id", ignoreDuplicates: true },
    );
    if (error) throw error;
  } catch {
    return NextResponse.json({ error: "Falha ao persistir evento; tente novamente." }, { status: 503, headers: noStore });
  }

  // Queue only authenticated Sandbox payment events; do not trust payload as payment evidence.
  // Queue failures do not lose the durable inbox event; the existing retry path remains available.
  if (process.env.ASAAS_RECONCILIATION_QUEUE_ENABLED === "true" &&
      /^PAYMENT_[A-Z_]{1,90}$/.test(eventType) &&
      /^[A-Za-z0-9_-]{1,128}$/.test(eventId)) {
    const payment = event.payment;
    const paymentId = payment && typeof payment === "object" && !Array.isArray(payment)
      ? (payment as Record<string, unknown>).id : null;
    if (typeof paymentId !== "string" || !/^pay_[A-Za-z0-9]+$/.test(paymentId)) {
      return NextResponse.json({ error: "Referência de pagamento ausente ou inválida." }, { status: 422, headers: noStore });
    }
    try {
      const { error: enqueueError } = await createSupabaseAdmin().rpc("enqueue_asaas_reconciliation_event", {
        p_event_id: eventId, p_event_type: eventType, p_payment_id: paymentId,
      });
      if (enqueueError) throw enqueueError;
    } catch {
      return NextResponse.json({ error: "Fila indisponível; tente novamente." }, { status: 503, headers: noStore });
    }
  }

  // Reconciliation is performed by the lease-based queue worker or the authenticated retry route.
  // Never process a pending event inline: it must first be atomically claimed.

  // Acknowledge only after durable storage.
  return NextResponse.json({ received: true }, { status: 200, headers: noStore });
}
