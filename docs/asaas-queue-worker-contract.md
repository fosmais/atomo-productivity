# Reconciliation worker contract (not deployed)

The migration `20261101_billing_queue_atomic_claim.sql` adds a service-role-only
atomic queue claim, using `FOR UPDATE SKIP LOCKED`. It depends on
`20261101_billing_reconciliation_queue.sql` and has **not** been applied.

Before activating a worker:
- Only the backend service role may call the claim function.
- Claim returns at most one due event, with a lease between 30–600 seconds.
- Never trust a webhook payload as payment confirmation.
- Reconcile by fetching authoritative payment and subscription details.
- Validate customer ownership, plan amount, currency and billing period.
- Persist the outcome idempotently in a transaction; avoid stale event overwrites.
- Add explicit expired-lease recovery, bounded retry and audit trails.
- Test parallel workers and failures between claim, provider read and commit.

No cron or queue processor has been activated. No live DB migration applied.
