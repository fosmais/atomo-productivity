import "server-only";
import { asaasSandboxGet, asaasSandboxReady } from "@/lib/billing/asaas";

/** Provider-verified evidence only. A webhook payload is never payment evidence. */
export type VerifiedPayment = {
  id: string;
  subscriptionId: string;
  status: "CONFIRMED" | "RECEIVED" | "PENDING" | "OVERDUE" | "REFUNDED" | "OTHER";
  value: number;
  dueDate: string | null;
  paymentDate: string | null;
};

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}

function validId(id: string): boolean {
  return /^[a-zA-Z0-9_-]{1,100}$/.test(id);
}

export async function verifyAsaasSandboxPayment(paymentId: string): Promise<VerifiedPayment> {
  if (!asaasSandboxReady() || !validId(paymentId)) throw new Error("Conciliação indisponível.");
  const record = object(await asaasSandboxGet(`/payments/${paymentId}`));
  if (!record || record.id !== paymentId || typeof record.subscription !== "string" ||
      !validId(record.subscription) || typeof record.value !== "number" ||
      !Number.isFinite(record.value) || record.value <= 0) {
    throw new Error("Dados financeiros não verificáveis.");
  }
  const allowed = ["CONFIRMED", "RECEIVED", "PENDING", "OVERDUE", "REFUNDED"];
  return {
    id: paymentId,
    subscriptionId: record.subscription,
    status: typeof record.status === "string" && allowed.includes(record.status)
      ? record.status as VerifiedPayment["status"] : "OTHER",
    value: record.value,
    dueDate: typeof record.dueDate === "string" ? record.dueDate : null,
    paymentDate: typeof record.paymentDate === "string" ? record.paymentDate : null,
  };
}

/** Read-only verification. Does not grant entitlements or update the database. */
export async function verifyAsaasSandboxSubscription(subscriptionId: string) {
  if (!asaasSandboxReady() || !validId(subscriptionId)) throw new Error("Conciliação indisponível.");
  const record = object(await asaasSandboxGet(`/subscriptions/${subscriptionId}`));
  if (!record || record.id !== subscriptionId || typeof record.status !== "string" ||
      typeof record.customer !== "string" || !validId(record.customer)) {
    throw new Error("Assinatura não verificável.");
  }
  return { id: subscriptionId, status: record.status, customerId: record.customer };
}
