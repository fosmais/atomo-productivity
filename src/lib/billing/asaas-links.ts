import "server-only";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { asaasSandboxGet } from "@/lib/billing/asaas";

type RemoteSubscription = {
  id?: unknown;
  customer?: unknown;
  status?: unknown;
};

export type VerifiedAsaasLink = {
  userId: string;
  planId: "pro" | "premium";
  customerId: string;
  subscriptionId: string;
};

/**
 * Resolve an Asaas subscription only through server-created, immutable links.
 * A payment event must never supply the user or plan to be credited.
 */
export async function verifyAsaasSubscriptionLink(
  subscriptionId: string,
  paymentCustomerId: string,
): Promise<VerifiedAsaasLink> {
  if (!/^sub_[A-Za-z0-9]+$/.test(subscriptionId) ||
      !/^cus_[A-Za-z0-9]+$/.test(paymentCustomerId)) {
    throw new Error("Identificadores Asaas inválidos.");
  }
  const admin = createSupabaseAdmin();
  const { data: link, error } = await admin.from("asaas_subscription_links")
    .select("user_id,plan_id,asaas_customer_id,asaas_subscription_id")
    .eq("asaas_subscription_id", subscriptionId).maybeSingle();
  if (error || !link || link.asaas_customer_id !== paymentCustomerId ||
      (link.plan_id !== "pro" && link.plan_id !== "premium")) {
    throw new Error("Assinatura sem vínculo confiável.");
  }

  const { data: customer, error: customerError } = await admin.from("asaas_customer_links")
    .select("user_id").eq("asaas_customer_id", paymentCustomerId).maybeSingle();
  if (customerError || !customer || customer.user_id !== link.user_id) {
    throw new Error("Cliente não pertence ao usuário da assinatura.");
  }

  const remote = await asaasSandboxGet("/subscriptions/" + subscriptionId) as RemoteSubscription;
  if (remote.id !== subscriptionId || remote.customer !== paymentCustomerId) {
    throw new Error("Assinatura diverge dos dados oficiais do Asaas.");
  }

  return {
    userId: link.user_id,
    planId: link.plan_id,
    customerId: paymentCustomerId,
    subscriptionId,
  };
}
