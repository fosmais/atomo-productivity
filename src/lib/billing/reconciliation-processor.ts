import { decidePaidAccess, type ReconciliationEvidence } from "./reconciliation-policy";
import { planReconciliationFailure, type ReconciliationFailure } from "./reconciliation-queue";

export type QueuedBillingEvent = {
  id: number;
  eventType: string;
  providerPaymentId: string | null;
  attempts: number;
  lockedUntil: string;
};

export type ReconciliationOutcome =
  | { kind: "verified"; reason: string }
  | { kind: "retry"; reason: ReconciliationFailure; nextAttemptAt: string; attempts: number }
  | { kind: "rejected"; reason: string; attempts: number };

/**
 * Purely orchestrates a verified decision. No live provider or DB writes.
 * The eventual worker must use its lease-fenced SQL completion transaction.
 */
export async function evaluateQueuedBillingEvent(
  job: QueuedBillingEvent,
  loadVerifiedEvidence: (paymentId: string) => Promise<ReconciliationEvidence>,
  now = Date.now(),
): Promise<ReconciliationOutcome> {
  if (!Number.isSafeInteger(job.id) || job.id <= 0 ||
      !Number.isSafeInteger(job.attempts) || job.attempts < 0 ||
      !Number.isFinite(Date.parse(job.lockedUntil))) {
    return { kind: "rejected", reason: "INVALID_JOB", attempts: Math.max(0, job.attempts || 0) };
  }
  if (!/^PAYMENT_[A-Z_]{1,90}$/.test(job.eventType) ||
      !job.providerPaymentId || !/^[a-zA-Z0-9_-]{1,100}$/.test(job.providerPaymentId)) {
    return { kind: "rejected", reason: "INVALID_EVENT", attempts: job.attempts + 1 };
  }
  if (Date.parse(job.lockedUntil) <= now) {
    return { kind: "rejected", reason: "EXPIRED_LEASE", attempts: job.attempts };
  }

  try {
    const evidence = await loadVerifiedEvidence(job.providerPaymentId);
    const decision = decidePaidAccess(evidence, now);
    if (decision.eligible) return { kind: "verified", reason: decision.reason };
    const failure: ReconciliationFailure =
      decision.reason === "SUBSCRIPTION_MISMATCH" ? "ownership_mismatch" :
      decision.reason === "PAYMENT_UNCONFIRMED" ? "payment_unconfirmed" :
      "invalid_event";
    const retry = planReconciliationFailure(failure, job.attempts, now);
    return retry.state === "retry"
      ? { kind: "retry", reason: failure, nextAttemptAt: retry.nextAttemptAt!, attempts: retry.attempts }
      : { kind: "rejected", reason: decision.reason, attempts: retry.attempts };
  } catch {
    const retry = planReconciliationFailure("provider_unavailable", job.attempts, now);
    return retry.state === "retry"
      ? { kind: "retry", reason: retry.reason, nextAttemptAt: retry.nextAttemptAt!, attempts: retry.attempts }
      : { kind: "rejected", reason: "PROVIDER_UNAVAILABLE", attempts: retry.attempts };
  }
}
