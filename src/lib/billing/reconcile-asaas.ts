import "server-only";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { asaasSandboxGet } from "@/lib/billing/asaas";
import { verifyAsaasSubscriptionLink } from "@/lib/billing/asaas-links";

type AsaasPayment = {
  id?: unknown;
  status?: unknown;
  subscription?: unknown;
  customer?: unknown;
};

/**
 * Verifies a stored payment event against Asaas Sandbox.
 * Audit-only: never grants entitlements or changes a subscription.
 * Idempotent event IDs are enforced by the inbox unique constraint.
 */
export async function reconcileAsaasPaymentEvent(eventId: string): Promise<"verified" | "ignored"> {
  const admin = createSupabaseAdmin();
  const { data: event, error } = await admin.from("asaas_webhook_inbox")
    .select("event_id,event_type,payload,state")
    .eq("event_id", eventId).maybeSingle();
  if (error || !event) throw new Error("Evento não encontrado.");
  if (event.state === "processed") return "verified";
  if (event.state !== "processing") throw new Error("Evento não reservado para conciliação.");

  const payload = event.payload as Record<string, unknown> | null;
  const payment = payload?.payment;
  if (!event.event_type.startsWith("PAYMENT_") || !payment ||
      typeof payment !== "object" || Array.isArray(payment) ||
      typeof (payment as Record<string, unknown>).id !== "string") {
    throw new Error("Evento sem pagamento conciliável.");
  }
  const paymentId = (payment as Record<string, unknown>).id as string;
  if (!/^pay_[a-zA-Z0-9]+$/.test(paymentId)) throw new Error("ID de pagamento inválido.");

  const verified = await asaasSandboxGet("/payments/" + paymentId) as AsaasPayment;
  if (verified.id !== paymentId || typeof verified.status !== "string") {
    throw new Error("Divergência na consulta do pagamento.");
  }
  const subscriptionId = typeof verified.subscription === "string" ? verified.subscription : null;
  if (!subscriptionId || typeof verified.customer !== "string") {
    throw new Error("Pagamento sem vínculo de assinatura verificável.");
  }
  await verifyAsaasSubscriptionLink(subscriptionId, verified.customer);
  if (verified.status !== "CONFIRMED" && verified.status !== "RECEIVED") {
    throw new Error("Pagamento ainda não confirmado pelo Asaas.");
  }

  const { data: saved, error: saveError } = await admin.from("asaas_webhook_inbox").update({
    payment_id: paymentId,
    subscription_id: subscriptionId,
    verified_payment_status: verified.status,
    reconciled_at: new Date().toISOString(),
    state: "processed",
    processed_at: new Date().toISOString(),
    last_error: null,
  }).eq("event_id", eventId).eq("state", "processing").select("event_id").maybeSingle();
  if (saveError || !saved) throw new Error("Falha ao registrar conciliação.");
  return "verified";
}
