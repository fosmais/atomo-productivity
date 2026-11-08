import "server-only";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { asaasSandboxGet } from "@/lib/billing/asaas";
import { createAsaasSandboxCustomer, createAsaasSandboxSubscription } from "@/lib/billing/asaas-provisioning";
import { getAsaasSandboxCustomerLink, linkAsaasSandboxCustomer, linkAsaasSandboxSubscription, assertNoExistingAsaasSandboxSubscription } from "@/lib/billing/asaas-link-persistence";
import { reserveAsaasSandboxOperation, recordAsaasSandboxOperation } from "@/lib/billing/asaas-provisioning-operations";

function requireExplicitSandboxAuthorization(authorized: boolean) {
  if (!authorized || process.env.ASAAS_ENVIRONMENT !== "sandbox" ||
      process.env.ASAAS_SANDBOX_PROVISIONING_ENABLED !== "true" ||
      process.env.ASAAS_SANDBOX_TEST_ENDPOINT_ENABLED !== "true") {
    throw new Error("Provisionamento de teste não autorizado.");
  }
}

/**
 * Internal server-only orchestrator. The caller MUST verify the authenticated
 * user, current legal consent, and an explicit test-only action before calling.
 * No public route invokes this function yet.
 */
export async function provisionAsaasSandboxCustomer(input: {
  userId: string; name: string; email: string; cpfCnpj: string;
  explicitlyAuthorized: boolean;
}) {
  requireExplicitSandboxAuthorization(input.explicitlyAuthorized);
  const admin = createSupabaseAdmin();
  const linked = await getAsaasSandboxCustomerLink(admin, input.userId);
  if (linked) return { customerId: linked, alreadyLinked: true };
  const operation = await reserveAsaasSandboxOperation(admin, {
    userId: input.userId, type: "customer", context: "sandbox-customer-v1",
  });
  // A prior attempt may have reached the provider but not persisted its result.
  // Never automatically retry a provider POST after any reserved operation.
  if (!operation.isNew) {
    throw new Error("Cadastro Sandbox pendente de conciliação; criação duplicada bloqueada.");
  }
  let customerId: string;
  try {
    customerId = await createAsaasSandboxCustomer({
      name: input.name, email: input.email, cpfCnpj: input.cpfCnpj,
      externalReference: input.userId,
    });
  } catch {
    await recordAsaasSandboxOperation(admin, {
      operationId: operation.id, state: "needs_recovery",
    }).catch(() => undefined);
    throw new Error("Resultado do cadastro Asaas incerto; revisão necessária antes de nova tentativa.");
  }
  await recordAsaasSandboxOperation(admin, {
    operationId: operation.id, state: "remote_created", providerId: customerId,
  });
  await linkAsaasSandboxCustomer(admin, input.userId, customerId);
  await recordAsaasSandboxOperation(admin, {
    operationId: operation.id, state: "completed", providerId: customerId,
  });
  return { customerId, alreadyLinked: false };
}

export async function provisionAsaasSandboxSubscription(input: {
  userId: string; customerId: string; planId: "pro" | "premium";
  nextDueDate: string; explicitlyAuthorized: boolean;
}) {
  requireExplicitSandboxAuthorization(input.explicitlyAuthorized);
  const admin = createSupabaseAdmin();
  const customerId = await getAsaasSandboxCustomerLink(admin, input.userId);
  if (customerId !== input.customerId) throw new Error("Cliente Sandbox não pertence ao usuário.");
  await assertNoExistingAsaasSandboxSubscription(admin, input.userId);
  const { BILLING_PLANS } = await import("@/lib/billing/plans");
  const amountCents = BILLING_PLANS[input.planId].monthlyPriceCents;
  const operation = await reserveAsaasSandboxOperation(admin, {
    userId: input.userId, type: "subscription",
    context: JSON.stringify({ customerId, planId: input.planId, dueDate: input.nextDueDate }),
    customerId, planId: input.planId, amountCents,
  });
  if (!operation.isNew) {
    throw new Error("Assinatura Sandbox pendente de conciliação; duplicação bloqueada.");
  }
  let subscriptionId: string;
  try {
    subscriptionId = await createAsaasSandboxSubscription({
      customerId, planId: input.planId, nextDueDate: input.nextDueDate,
    });
  } catch {
    await recordAsaasSandboxOperation(admin, {
      operationId: operation.id, state: "needs_recovery",
    }).catch(() => undefined);
    throw new Error("Resultado da assinatura Asaas incerto; revisão necessária.");
  }
  await recordAsaasSandboxOperation(admin, {
    operationId: operation.id, state: "remote_created", providerId: subscriptionId,
  });
  await linkAsaasSandboxSubscription(admin, {
    userId: input.userId, customerId, subscriptionId, planId: input.planId,
  });
  await recordAsaasSandboxOperation(admin, {
    operationId: operation.id, state: "completed", providerId: subscriptionId,
  });
  // No billing_subscriptions activation, no entitlement, no real checkout.
  return { subscriptionId, entitlementGranted: false as const };
}

/**
 * Recover a provider-created record without issuing a second POST.
 * Only operations already marked remote_created and owned by the caller
 * can be linked. The provider record is checked before persistence.
 */
export async function recoverAsaasSandboxOperation(input: {
  userId: string; operationId: string; explicitlyAuthorized: boolean;
}) {
  requireExplicitSandboxAuthorization(input.explicitlyAuthorized);
  const admin = createSupabaseAdmin();
  const { data: operation, error } = await admin.from("asaas_provisioning_operations")
    .select("id,user_id,operation_type,state,provider_id,expected_customer_id,expected_plan_id,expected_amount_cents")
    .eq("id", input.operationId).eq("user_id", input.userId).maybeSingle();
  if (error || !operation) throw new Error("Operação Sandbox não encontrada.");
  if (operation.state === "completed") return { recovered: true, alreadyCompleted: true };
  if (operation.state !== "remote_created" || !operation.provider_id)
    throw new Error("Operação exige revisão manual antes da recuperação.");
  if (operation.operation_type === "customer") {
    if (!/^cus_[A-Za-z0-9]+$/.test(operation.provider_id)) throw new Error("Cliente inválido.");
    const remote = await asaasSandboxGet("/customers/" + operation.provider_id) as Record<string, unknown>;
    if (remote.id !== operation.provider_id || remote.externalReference !== input.userId)
      throw new Error("Cliente remoto não corresponde ao usuário.");
    await linkAsaasSandboxCustomer(admin, input.userId, operation.provider_id);
  } else if (operation.operation_type === "subscription") {
    if (!/^sub_[A-Za-z0-9]+$/.test(operation.provider_id) ||
        !/^cus_[A-Za-z0-9]+$/.test(operation.expected_customer_id ?? "") ||
        (operation.expected_plan_id !== "pro" && operation.expected_plan_id !== "premium"))
      throw new Error("Assinatura inválida.");
    const linked = await getAsaasSandboxCustomerLink(admin, input.userId);
    if (linked !== operation.expected_customer_id) throw new Error("Cliente não vinculado.");
    const remote = await asaasSandboxGet("/subscriptions/" + operation.provider_id) as Record<string, unknown>;
    if (remote.id !== operation.provider_id || remote.customer !== linked ||
        typeof remote.value !== "number" ||
        Math.round(remote.value * 100) !== operation.expected_amount_cents)
      throw new Error("Assinatura remota diverge da operação.");
    await linkAsaasSandboxSubscription(admin, {
      userId: input.userId, customerId: linked,
      subscriptionId: operation.provider_id, planId: operation.expected_plan_id,
    });
  } else {
    throw new Error("Tipo de operação inválido.");
  }
  await recordAsaasSandboxOperation(admin, {
    operationId: operation.id, state: "completed", providerId: operation.provider_id,
  });
  return { recovered: true, alreadyCompleted: false, entitlementGranted: false };
}
