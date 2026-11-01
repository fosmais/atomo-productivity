/** Pure queue scheduling rules. Does not read or write the database. */
export type ReconciliationJobState = "pending" | "processing" | "verified" | "rejected" | "retry";
export type ReconciliationFailure = "provider_unavailable" | "invalid_event" | "ownership_mismatch" | "payment_unconfirmed" | "unexpected";

export type RetryDecision = {
  state: "retry" | "rejected";
  nextAttemptAt: string | null;
  attempts: number;
  reason: ReconciliationFailure;
};

const MAX_ATTEMPTS = 8;
const MAX_DELAY_MS = 6 * 60 * 60 * 1000;

/**
 * Permanent errors never retry. Transient provider errors use bounded
 * exponential backoff; retry timing is deterministic for testability.
 */
export function planReconciliationFailure(
  failure: ReconciliationFailure,
  previousAttempts: number,
  now: number = Date.now(),
): RetryDecision {
  if (!Number.isSafeInteger(previousAttempts) || previousAttempts < 0 ||
      !Number.isFinite(now) || now < 0) {
    throw new Error("Invalid reconciliation scheduling inputs.");
  }
  const attempts = previousAttempts + 1;
  const permanent = failure === "invalid_event" || failure === "ownership_mismatch";
  if (permanent || attempts >= MAX_ATTEMPTS) {
    return { state: "rejected", nextAttemptAt: null, attempts, reason: failure };
  }
  const delay = Math.min(MAX_DELAY_MS, 60_000 * (2 ** (attempts - 1)));
  return { state: "retry", nextAttemptAt: new Date(now + delay).toISOString(), attempts, reason: failure };
}

export function shouldProcessReconciliationJob(
  state: ReconciliationJobState,
  nextAttemptAt: string,
  lockedUntil: string | null,
  now: number = Date.now(),
): boolean {
  if (state !== "pending" && state !== "retry") return false;
  const due = Date.parse(nextAttemptAt);
  if (!Number.isFinite(due) || due > now) return false;
  if (lockedUntil !== null) {
    const lock = Date.parse(lockedUntil);
    if (!Number.isFinite(lock) || lock > now) return false;
  }
  return true;
}
