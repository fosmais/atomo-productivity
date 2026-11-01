import "server-only";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { getBillingPlan, hasBillingFeature, type BillingPlanId } from "./plans";

type SubscriptionRow = {
  plan_id: string;
  status: string;
  current_period_end: string | null;
};

/**
 * Resolve entitlements only from server-controlled billing records.
 * Missing rows default to Free. Database errors fail closed.
 * Paid access requires an active/trialing status and a valid future period end.
 */
export async function getUserEntitlements(userId: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
    throw new Error("Identificador de usuário inválido.");
  }
  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from("billing_subscriptions")
    .select("plan_id,status,current_period_end")
    .eq("user_id", userId)
    .maybeSingle<SubscriptionRow>();

  if (error) {
    // Never grant paid access when the billing database is unavailable.
    throw new Error("Não foi possível validar a assinatura.");
  }

  const now = Date.now();
  const paidActive =
    data &&
    (data.status === "active" || data.status === "trialing") &&
    data.current_period_end !== null &&
    Number.isFinite(Date.parse(data.current_period_end)) &&
    Date.parse(data.current_period_end) > now;

  const planId: BillingPlanId =
    paidActive && (data.plan_id === "pro" || data.plan_id === "premium")
      ? data.plan_id
      : "free";
  const plan = getBillingPlan(planId);
  return {
    planId,
    name: plan.name,
    aiMessagesPerDay: plan.aiMessagesPerDay,
    features: [...plan.features] as string[],
    hasFeature: (feature: string) => hasBillingFeature(planId, feature),
  };
}
