import "server-only";
import { asaasSandboxPost, asaasSandboxReady } from "@/lib/billing/asaas";
import { BILLING_PLANS } from "@/lib/billing/plans";

type PaidPlan = "pro" | "premium";
type AsaasRecord = Record<string, unknown>;

function record(value: unknown): AsaasRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Resposta inválida do Asaas.");
  }
  return value as AsaasRecord;
}

function id(value: unknown, prefix: "cus" | "sub"): string {
  if (typeof value !== "string" || !new RegExp("^" + prefix + "_[A-Za-z0-9]+$").test(value)) {
    throw new Error("Identificador Asaas inválido.");
  }
  return value;
}

/**
 * Creates a sandbox customer only. Caller must check authenticated ownership,
 * explicit consent, and existing customer links before calling this function.
 * Never pass user-controlled arbitrary fields to Asaas.
 */
export async function createAsaasSandboxCustomer(input: {
  name: string;
  email: string;
  cpfCnpj: string;
  externalReference: string;
}): Promise<string> {
  if (!asaasSandboxReady() || process.env.ASAAS_SANDBOX_PROVISIONING_ENABLED !== "true") {
    throw new Error("Provisionamento Sandbox indisponível.");
  }
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const cpfCnpj = input.cpfCnpj.replace(/\D/g, "");
  if (name.length < 2 || name.length > 120 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 ||
      !/^(\d{11}|\d{14})$/.test(cpfCnpj) ||
      !/^[0-9a-f-]{36}$/i.test(input.externalReference)) {
    throw new Error("Dados do cliente inválidos.");
  }
  const response = record(await asaasSandboxPost("/customers", {
    name, email, cpfCnpj, externalReference: input.externalReference,
  }));
  return id(response.id, "cus");
}

/**
 * Creates a sandbox-only monthly subscription. Does not enable checkout,
 * grant entitlements, or write a MYRYRA subscription record.
 * Caller must persist links atomically and reconcile subsequent events.
 */
export async function createAsaasSandboxSubscription(input: {
  customerId: string;
  planId: PaidPlan;
  nextDueDate: string;
}): Promise<string> {
  if (!asaasSandboxReady() || process.env.ASAAS_SANDBOX_PROVISIONING_ENABLED !== "true") {
    throw new Error("Provisionamento Sandbox indisponível.");
  }
  const customer = id(input.customerId, "cus");
  const price = BILLING_PLANS[input.planId]?.monthlyPriceCents;
  if (!price || !/^\d{4}-\d{2}-\d{2}$/.test(input.nextDueDate) ||
      !Number.isFinite(Date.parse(input.nextDueDate + "T00:00:00Z")) ||
      new Date(input.nextDueDate + "T00:00:00Z").toISOString().slice(0, 10) !== input.nextDueDate) {
    throw new Error("Assinatura Sandbox inválida.");
  }
  const response = record(await asaasSandboxPost("/subscriptions", {
    customer, billingType: "UNDEFINED", cycle: "MONTHLY",
    value: price / 100, nextDueDate: input.nextDueDate,
    description: "MYRYRA " + input.planId.toUpperCase() + " (Sandbox)",
  }));
  return id(response.id, "sub");
}
