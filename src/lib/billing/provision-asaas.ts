import "server-only";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { asaasSandboxPost } from "@/lib/billing/asaas";
import { BILLING_PLANS } from "@/lib/billing/plans";
import { reserveAsaasOperation, updateAsaasOperation } from "@/lib/billing/asaas-operations";

type PaidPlan = "pro" | "premium";
type BillingType = "PIX" | "CREDIT_CARD";

type CustomerResponse = { id?: unknown };
type SubscriptionResponse = { id?: unknown; customer?: unknown };

function assertUuid(id: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    throw new Error("Usuário inválido.");
  }
}

/**
 * Sandbox-only provisioning primitives. Not exposed to the checkout API until
 * customer data validation, concurrency locks and recovery are implemented.
 */
export async function provisionAsaasSandboxCustomer(userId: string, name: string, email: string, cpfCnpj: string) {
  assertUuid(userId);
  if (name.trim().length < 3 || name.length > 150 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      !/^(\d{11}|\d{14})$/.test(cpfCnpj)) throw new Error("Dados de cadastro inválidos.");
  const admin = createSupabaseAdmin();
  const { data: existing, error: lookupError } = await admin.from("asaas_customer_links")
    .select("asaas_customer_id").eq("user_id", userId).maybeSingle();
  if (lookupError) throw new Error("Não foi possível consultar o cliente.");
  if (existing) return existing.asaas_customer_id as string;

  const operationId = await reserveAsaasOperation(userId, "customer", userId);
  const remote = await asaasSandboxPost("/customers", {
    name: name.trim(), email: email.trim(), cpfCnpj,
    externalReference: userId,
    notificationDisabled: true,
  }) as CustomerResponse;
  if (typeof remote.id !== "string" || !/^cus_[A-Za-z0-9]+$/.test(remote.id)) {
    throw new Error("Cadastro Asaas não retornou identificador válido.");
  }
  await updateAsaasOperation(operationId, "remote_created", remote.id);
  const { error } = await admin.from("asaas_customer_links")
    .insert({ user_id: userId, asaas_customer_id: remote.id });
  if (error) throw new Error("Cliente criado no Sandbox, mas vínculo local requer recuperação.");
  await updateAsaasOperation(operationId, "completed", remote.id);
  return remote.id;
}

export async function provisionAsaasSandboxSubscription(
  userId: string, planId: PaidPlan, billingType: BillingType,
) {
  assertUuid(userId);
  if (planId !== "pro" && planId !== "premium") throw new Error("Plano inválido.");
  if (billingType !== "PIX" && billingType !== "CREDIT_CARD") throw new Error("Forma de pagamento inválida.");
  const admin = createSupabaseAdmin();
  const { data: customer, error: customerError } = await admin.from("asaas_customer_links")
    .select("asaas_customer_id").eq("user_id", userId).maybeSingle();
  if (customerError || !customer) throw new Error("Cliente ainda não vinculado.");
  const { data: existing, error: lookupError } = await admin.from("asaas_subscription_links")
    .select("asaas_subscription_id").eq("user_id", userId).limit(1);
  if (lookupError) throw new Error("Não foi possível consultar assinaturas.");
  if (existing?.length) throw new Error("Assinatura existente requer reconciliação antes de nova contratação.");

  const due = new Date();
  due.setUTCDate(due.getUTCDate() + 2);
  const nextDueDate = due.toISOString().slice(0, 10);
  const operationId = await reserveAsaasOperation(userId, "subscription", `${userId}:${planId}:${billingType}`);
  const remote = await asaasSandboxPost("/subscriptions", {
    customer: customer.asaas_customer_id,
    billingType,
    value: BILLING_PLANS[planId].monthlyPriceCents / 100,
    nextDueDate,
    cycle: "MONTHLY",
    description: `MYRYRA ${BILLING_PLANS[planId].name} - Sandbox`,
    externalReference: userId,
  }) as SubscriptionResponse;
  if (typeof remote.id !== "string" || !/^sub_[A-Za-z0-9]+$/.test(remote.id) ||
      remote.customer !== customer.asaas_customer_id) {
    throw new Error("Assinatura Asaas divergente.");
  }
  await updateAsaasOperation(operationId, "remote_created", remote.id);
  const { error } = await admin.from("asaas_subscription_links").insert({
    asaas_subscription_id: remote.id,
    user_id: userId,
    asaas_customer_id: customer.asaas_customer_id,
    plan_id: planId,
  });
  if (error) throw new Error("Assinatura criada no Sandbox, mas vínculo local requer recuperação.");
  await updateAsaasOperation(operationId, "completed", remote.id);
  return remote.id;
}
