/** Pure queue scheduling rules. No DB writes or entitlement grants. */
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

export function planReconciliationFailure(
  failure: ReconciliationFailure,
  previousAttempts: number,
  now: number = Date.now(),
): RetryDecision {
  if (!Number.isSafeInteger(previousAttempts) || previousAttempts < 0 ||
      !Number.isFinite(now) || now < 0) throw new Error("Invalid scheduling inputs.");
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

/** Expired leases require explicit recovery by an audited worker. */
export function isExpiredProcessingLease(
  state: ReconciliationJobState,
  lockedUntil: string | null,
  now: number = Date.now(),
): boolean {
  if (state !== "processing" || lockedUntil === null) return false;
  const expiry = Date.parse(lockedUntil);
  return Number.isFinite(expiry) && expiry <= now;
}
