/** Audit-only event classification. No event grants access. */
export const ASAAS_RECONCILIATION_EVENTS = [
  "PAYMENT_CONFIRMED",
  "PAYMENT_RECEIVED",
  "PAYMENT_OVERDUE",
  "PAYMENT_REFUNDED",
  "PAYMENT_DELETED",
  "PAYMENT_RESTORED",
  "PAYMENT_CHARGEBACK_REQUESTED",
  "PAYMENT_CHARGEBACK_DISPUTE",
] as const;

export type AsaasReconciliationEvent = typeof ASAAS_RECONCILIATION_EVENTS[number];

export function isReconciliationEvent(value: unknown): value is AsaasReconciliationEvent {
  return typeof value === "string" &&
    (ASAAS_RECONCILIATION_EVENTS as readonly string[]).includes(value);
}

export function readAsaasPaymentReference(payload: unknown): string | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const payment = (payload as Record<string, unknown>).payment;
  if (!payment || typeof payment !== "object" || Array.isArray(payment)) return null;
  const id = (payment as Record<string, unknown>).id;
  return typeof id === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(id) ? id : null;
}
