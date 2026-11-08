import "server-only";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createSupabaseAdmin>;
type PaidPlan = "pro" | "premium";

export async function getAsaasSandboxCustomerLink(admin: Admin, userId: string) {
  const { data, error } = await admin.from("asaas_customer_links")
    .select("asaas_customer_id").eq("user_id", userId).maybeSingle();
  if (error) throw new Error("Falha ao consultar cliente Sandbox.");
  return data?.asaas_customer_id ?? null;
}

/** Idempotent link persistence; never overwrite an existing customer link. */
export async function linkAsaasSandboxCustomer(admin: Admin, userId: string, customerId: string) {
  if (!/^cus_[A-Za-z0-9]+$/.test(customerId)) throw new Error("Cliente Sandbox inválido.");
  const existing = await getAsaasSandboxCustomerLink(admin, userId);
  if (existing) {
    if (existing !== customerId) throw new Error("Cliente Sandbox já vinculado.");
    return;
  }
  const { error } = await admin.from("asaas_customer_links")
    .insert({ user_id: userId, asaas_customer_id: customerId });
  if (error) {
    if (await getAsaasSandboxCustomerLink(admin, userId) === customerId) return;
    throw new Error("Não foi possível registrar cliente Sandbox.");
  }
}

/**
 * Immutable subscription link. This does not create a payment or grant access.
 * Callers must avoid blind retries after provider-side subscription creation.
 */
export async function linkAsaasSandboxSubscription(
  admin: Admin,
  input: { userId: string; customerId: string; subscriptionId: string; planId: PaidPlan },
) {
  if (!/^cus_[A-Za-z0-9]+$/.test(input.customerId) ||
      !/^sub_[A-Za-z0-9]+$/.test(input.subscriptionId) ||
      (input.planId !== "pro" && input.planId !== "premium")) {
    throw new Error("Vínculo Sandbox inválido.");
  }
  const linkedCustomer = await getAsaasSandboxCustomerLink(admin, input.userId);
  if (linkedCustomer !== input.customerId) throw new Error("Cliente não pertence ao usuário.");
  const { data: existing, error: lookupError } = await admin.from("asaas_subscription_links")
    .select("user_id,asaas_customer_id,plan_id")
    .eq("asaas_subscription_id", input.subscriptionId).maybeSingle();
  if (lookupError) throw new Error("Falha ao consultar assinatura Sandbox.");
  if (existing) {
    if (existing.user_id !== input.userId || existing.asaas_customer_id !== input.customerId ||
        existing.plan_id !== input.planId) throw new Error("Assinatura vinculada a outro contexto.");
    return;
  }
  const { error } = await admin.from("asaas_subscription_links").insert({
    asaas_subscription_id: input.subscriptionId, user_id: input.userId,
    asaas_customer_id: input.customerId, plan_id: input.planId,
  });
  if (error) {
    // A concurrent request may have inserted the same immutable link.
    // Confirm the exact ownership and plan before treating it as success.
    const { data: concurrent, error: concurrentError } = await admin
      .from("asaas_subscription_links")
      .select("user_id,asaas_customer_id,plan_id")
      .eq("asaas_subscription_id", input.subscriptionId).maybeSingle();
    if (!concurrentError && concurrent?.user_id === input.userId &&
        concurrent.asaas_customer_id === input.customerId &&
        concurrent.plan_id === input.planId) return;
    throw new Error("Falha ao registrar assinatura Sandbox.");
  }
}

/**
 * Preflight before creating any remote subscription. A user with an existing
 * linked Asaas subscription must be reviewed rather than provisioned again.
 * This guard is not a distributed lock; provider-side idempotency and an
 * operation ledger are still required before enabling checkout.
 */
export async function assertNoExistingAsaasSandboxSubscription(admin: Admin, userId: string) {
  const { data, error } = await admin.from("asaas_subscription_links")
    .select("asaas_subscription_id")
    .eq("user_id", userId).limit(1);
  if (error) throw new Error("Falha ao verificar assinaturas existentes.");
  if (data && data.length > 0) {
    throw new Error("Já existe uma assinatura Sandbox vinculada a este usuário.");
  }
  const { data: billing, error: billingError } = await admin.from("billing_subscriptions")
    .select("id")
    .eq("user_id", userId).eq("provider", "asaas").limit(1);
  if (billingError) throw new Error("Falha ao verificar histórico de assinaturas.");
  if (billing && billing.length > 0) {
    throw new Error("Existe uma assinatura Asaas que requer conciliação.");
  }
}
