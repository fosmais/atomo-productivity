import "server-only";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

type PaidPlan = "pro" | "premium";
type AttemptState = "reserved" | "customer_linked" | "subscription_created" | "failed" | "manual_review";

/**
 * The database partial unique index permits only one open attempt per user.
 * Never call the provider when this reservation fails or already exists.
 */
export async function reserveAsaasCheckoutAttempt(userId: string, planId: PaidPlan):
  Promise<{ id: string; state: "reserved" }> {
  if (process.env.ASAAS_ENVIRONMENT !== "sandbox" ||
      process.env.ASAAS_SANDBOX_PROVISIONING_ENABLED !== "true") {
    throw new Error("Checkout Sandbox desabilitado.");
  }
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i.test(userId) ||
      (planId !== "pro" && planId !== "premium")) {
    throw new Error("Dados da contratação inválidos.");
  }
  const { data, error } = await createSupabaseAdmin()
    .from("billing_asaas_checkout_attempts")
    .insert({ user_id: userId, plan_id: planId, state: "reserved" })
    .select("id, state")
    .single();
  if (error || !data || data.state !== "reserved" || typeof data.id !== "string") {
    throw new Error("Contratação já em andamento ou reserva indisponível.");
  }
  return { id: data.id, state: "reserved" };
}

/**
 * Strict state transitions. On provider uncertainty, use manual_review;
 * never mark failed and retry without verifying the provider outcome.
 */
export async function advanceAsaasCheckoutAttempt(input: {
  id: string;
  userId: string;
  from: "reserved" | "customer_linked";
  to: Exclude<AttemptState, "reserved">;
  subscriptionId?: string;
}): Promise<void> {
  if (process.env.ASAAS_ENVIRONMENT !== "sandbox") throw new Error("Sandbox obrigatório.");
  if ((input.to === "subscription_created" || (input.to === "manual_review" && input.subscriptionId)) &&
      (!input.subscriptionId || !/^sub_[A-Za-z0-9_-]{3,96}$/.test(input.subscriptionId))) {
    throw new Error("Assinatura não verificada.");
  }
  if (input.to !== "subscription_created" && input.to !== "manual_review" && input.subscriptionId) {
    throw new Error("Assinatura inesperada.");
  }
  const patch: Record<string, unknown> = {
    state: input.to,
    updated_at: new Date().toISOString(),
  };
  if (input.subscriptionId) patch.provider_subscription_id = input.subscriptionId;
  const { data, error } = await createSupabaseAdmin()
    .from("billing_asaas_checkout_attempts")
    .update(patch)
    .eq("id", input.id)
    .eq("user_id", input.userId)
    .eq("state", input.from)
    .select("id")
    .maybeSingle();
  if (error || !data) throw new Error("Transição de contratação recusada; conciliação necessária.");
}
