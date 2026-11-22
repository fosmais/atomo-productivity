/**
 * MIKA Financial Care — deterministic, side-effect-free request validation.
 * This module NEVER contacts Asaas or changes subscriptions.
 */
export type FinancialCareAction = "cancel_renewal" | "downgrade" | "request_refund";
export type FinancialCareRequest = {
  action: FinancialCareAction;
  confirmed: boolean;
  targetPlan?: "free" | "pro";
  paymentId?: string;
  reason?: string;
};
export type FinancialCareResult =
  | { ok: true; action: FinancialCareAction; requiresProviderExecution: boolean; effectiveAt: "period_end" | "review"; targetPlan?: "free" | "pro"; paymentId?: string; reason?: string }
  | { ok: false; code: "INVALID_REQUEST" | "CONFIRMATION_REQUIRED" | "TARGET_REQUIRED" | "PAYMENT_REQUIRED" | "REASON_REQUIRED" };

export function validateFinancialCareRequest(input: unknown): FinancialCareResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { ok: false, code: "INVALID_REQUEST" };
  const data = input as Record<string, unknown>;
  if (!["cancel_renewal", "downgrade", "request_refund"].includes(String(data.action))) return { ok: false, code: "INVALID_REQUEST" };
  if (data.confirmed !== true) return { ok: false, code: "CONFIRMATION_REQUIRED" };
  const action = data.action as FinancialCareAction;
  if (action === "cancel_renewal") {
    return { ok: true, action, requiresProviderExecution: true, effectiveAt: "period_end" };
  }
  if (action === "downgrade") {
    if (data.targetPlan !== "free" && data.targetPlan !== "pro") return { ok: false, code: "TARGET_REQUIRED" };
    return { ok: true, action, requiresProviderExecution: true, effectiveAt: "period_end", targetPlan: data.targetPlan };
  }
  if (typeof data.paymentId !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(data.paymentId)) return { ok: false, code: "PAYMENT_REQUIRED" };
  if (typeof data.reason !== "string" || data.reason.trim().length < 10 || data.reason.trim().length > 1000) return { ok: false, code: "REASON_REQUIRED" };
  return { ok: true, action, requiresProviderExecution: false, effectiveAt: "review", paymentId: data.paymentId, reason: data.reason.trim() };
}
