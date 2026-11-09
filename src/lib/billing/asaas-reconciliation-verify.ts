import "server-only";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { BILLING_PLANS } from "@/lib/billing/plans";
import {
  getVerifiedAsaasSandboxPayment,
  matchesAsaasSandboxSubscriptionPayment,
} from "@/lib/billing/asaas";

/**
 * Read-only reconciliation verification. Never activates entitlements or
 * changes subscription state. Payment and customer identity are checked
 * against independent server-side persistence, not webhook-provided values.
 */
export async function verifyAsaasSandboxPaymentForReconciliation(paymentId: string):
  Promise<{ verified: boolean; reason: string; userId?: string; planId?: "pro" | "premium" }> {
  if (process.env.ASAAS_ENVIRONMENT !== "sandbox") {
    return { verified: false, reason: "SANDBOX_DISABLED" };
  }
  const payment = await getVerifiedAsaasSandboxPayment(paymentId);
  if (!payment.subscription) return { verified: false, reason: "NOT_RECURRING" };
  const admin = createSupabaseAdmin();
  const { data: subscription, error: subscriptionError } = await admin
    .from("billing_subscriptions")
    .select("user_id, plan_id, provider, provider_subscription_id, status")
    .eq("provider", "asaas")
    .eq("provider_subscription_id", payment.subscription)
    .maybeSingle();
  if (subscriptionError) throw new Error("Falha ao consultar assinatura.");
  if (!subscription || (subscription.plan_id !== "pro" && subscription.plan_id !== "premium")) {
    return { verified: false, reason: "SUBSCRIPTION_NOT_FOUND" };
  }
  if (subscription.status !== "pending" && subscription.status !== "active") {
    return { verified: false, reason: "SUBSCRIPTION_STATE_UNEXPECTED" };
  }
  const { data: link, error: linkError } = await admin
    .from("billing_asaas_customer_links")
    .select("provider_customer_id")
    .eq("user_id", subscription.user_id)
    .maybeSingle();
  if (linkError) throw new Error("Falha ao consultar cliente vinculado.");
  if (!link) return { verified: false, reason: "CUSTOMER_LINK_MISSING" };
  const plan = BILLING_PLANS[subscription.plan_id as "pro" | "premium"];
  if (!matchesAsaasSandboxSubscriptionPayment(payment, {
    subscriptionId: subscription.provider_subscription_id,
    customerId: link.provider_customer_id,
    monthlyPriceCents: plan.monthlyPriceCents,
  })) return { verified: false, reason: "PAYMENT_MISMATCH_OR_UNPAID" };
  return {
    verified: true,
    reason: "MATCHED_PAID_PAYMENT",
    userId: subscription.user_id,
    planId: subscription.plan_id,
  };
}
