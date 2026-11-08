import "server-only";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
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
