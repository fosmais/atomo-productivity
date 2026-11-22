import { BILLING_PLANS, type BillingPlanId } from "./plans";

/**
 * Pure, fail-closed billing decision. Does not write records or grant access.
 * Callers must independently verify payment and subscription against Asaas.
 */
export type ReconciliationEvidence = {
  planId: BillingPlanId;
  subscriptionId: string;
  verifiedSubscriptionId: string;
  subscriptionStatus: string;
  verifiedPaymentSubscriptionId: string;
  paymentStatus: string;
  paymentAmountCents: number;
  currency: string;
  periodEnd: string;
  refundOrChargeback: boolean;
};

export type ReconciliationDecision = {
  eligible: boolean;
  reason: string;
  effectivePlanId: BillingPlanId;
  periodEnd: string | null;
};

export function decidePaidAccess(evidence: ReconciliationEvidence, now = Date.now()): ReconciliationDecision {
  const reject = (reason: string): ReconciliationDecision => ({
    eligible: false, reason, effectivePlanId: "free", periodEnd: null,
  });
  if (evidence.planId !== "pro" && evidence.planId !== "premium") return reject("INVALID_PLAN");
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(evidence.subscriptionId) ||
      evidence.verifiedSubscriptionId !== evidence.subscriptionId ||
      evidence.verifiedPaymentSubscriptionId !== evidence.subscriptionId) return reject("SUBSCRIPTION_MISMATCH");
  if (evidence.subscriptionStatus !== "ACTIVE") return reject("SUBSCRIPTION_INACTIVE");
  if (evidence.refundOrChargeback) return reject("REVERSED_PAYMENT");
  if (evidence.paymentStatus !== "CONFIRMED" && evidence.paymentStatus !== "RECEIVED") return reject("PAYMENT_UNCONFIRMED");
  if (evidence.currency !== "BRL" ||
      evidence.paymentAmountCents !== BILLING_PLANS[evidence.planId].monthlyPriceCents) return reject("AMOUNT_MISMATCH");
  const expiry = Date.parse(evidence.periodEnd);
  if (!Number.isFinite(expiry) || expiry <= now || expiry > now + 40 * 24 * 60 * 60 * 1000) {
    return reject("INVALID_PERIOD");
  }
  return { eligible: true, reason: "VERIFIED", effectivePlanId: evidence.planId, periodEnd: evidence.periodEnd };
}

/** This policy is intentionally not wired to webhook writes until Sandbox tests pass. */
