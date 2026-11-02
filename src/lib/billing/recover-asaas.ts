import "server-only";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { asaasSandboxGet } from "@/lib/billing/asaas";
import { BILLING_PLANS } from "@/lib/billing/plans";

type Operation = {
  id: string;
  user_id: string;
  operation_type: "customer" | "subscription";
  state: string;
  provider_id: string | null;
  expected_customer_id: string | null;
  expected_plan_id: string | null;
  expected_billing_type: string | null;
  expected_amount_cents: number | null;
};
type ProviderObject = { id?: unknown; customer?: unknown; externalReference?: unknown; billingType?: unknown; value?: unknown };

export async function recoverAsaasProvisioningOperation(id: string): Promise<"completed" | "manual_review"> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Operação inválida.");
  const admin = createSupabaseAdmin();
  const { data, error } = await admin.from("asaas_provisioning_operations")
    .select("id,user_id,operation_type,state,provider_id,expected_customer_id,expected_plan_id,expected_billing_type,expected_amount_cents").eq("id", id).maybeSingle();
  if (error || !data) throw new Error("Operação não encontrada.");
  const op = data as Operation;
  if (op.state === "completed") return "completed";
  if (!op.provider_id) return "manual_review";

  const isCustomer = op.operation_type === "customer";
  if (!isCustomer && op.operation_type !== "subscription") return "manual_review";
  const pattern = isCustomer ? /^cus_[A-Za-z0-9]+$/ : /^sub_[A-Za-z0-9]+$/;
  if (!pattern.test(op.provider_id)) return "manual_review";

  const remote = await asaasSandboxGet(
    (isCustomer ? "/customers/" : "/subscriptions/") + op.provider_id,
  ) as ProviderObject;
  if (remote.id !== op.provider_id || remote.externalReference !== op.user_id) {
    return "manual_review";
  }

  if (isCustomer) {
    const { data: existing, error: readError } = await admin.from("asaas_customer_links")
      .select("asaas_customer_id").eq("user_id", op.user_id).maybeSingle();
    if (readError || (existing && existing.asaas_customer_id !== op.provider_id)) return "manual_review";
    if (!existing) {
      const { error: writeError } = await admin.from("asaas_customer_links")
        .insert({ user_id: op.user_id, asaas_customer_id: op.provider_id });
      if (writeError) return "manual_review";
    }
  } else {
    if ((op.expected_plan_id !== "pro" && op.expected_plan_id !== "premium") ||
        (op.expected_billing_type !== "PIX" && op.expected_billing_type !== "CREDIT_CARD") ||
        !op.expected_customer_id || !Number.isSafeInteger(op.expected_amount_cents) ||
        op.expected_amount_cents !== BILLING_PLANS[op.expected_plan_id].monthlyPriceCents ||
        remote.customer !== op.expected_customer_id ||
        remote.billingType !== op.expected_billing_type ||
        typeof remote.value !== "number" ||
        Math.round(remote.value * 100) !== op.expected_amount_cents) {
      return "manual_review";
    }
    const { data: customer, error: customerError } = await admin.from("asaas_customer_links")
      .select("asaas_customer_id").eq("user_id", op.user_id).maybeSingle();
    if (customerError || customer?.asaas_customer_id !== op.expected_customer_id) return "manual_review";
    const { data: existing, error: readError } = await admin.from("asaas_subscription_links")
      .select("asaas_subscription_id,user_id,asaas_customer_id,plan_id").eq("asaas_subscription_id", op.provider_id).maybeSingle();
    if (readError || (existing && (existing.user_id !== op.user_id ||
        existing.asaas_customer_id !== op.expected_customer_id ||
        existing.plan_id !== op.expected_plan_id))) return "manual_review";
    const { data: otherSubscriptions, error: otherError } = await admin.from("asaas_subscription_links")
      .select("asaas_subscription_id").eq("user_id", op.user_id).neq("asaas_subscription_id", op.provider_id).limit(1);
    if (otherError || (otherSubscriptions && otherSubscriptions.length > 0)) return "manual_review";
    if (!existing) {
      const { error: writeError } = await admin.from("asaas_subscription_links").insert({
        asaas_subscription_id: op.provider_id,
        user_id: op.user_id,
        asaas_customer_id: op.expected_customer_id,
        plan_id: op.expected_plan_id,
      });
      if (writeError) return "manual_review";
    }
  }

  const { error: completeError } = await admin.from("asaas_provisioning_operations")
    .update({ state: "completed", updated_at: new Date().toISOString(), last_error: null })
    .eq("id", op.id).eq("provider_id", op.provider_id);
  if (completeError) return "manual_review";
  return "completed";
}
