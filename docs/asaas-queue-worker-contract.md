# MYRYRA Asaas — Consolidated queue contract

Three staged migrations, **not applied**:
1. `20261101_billing_reconciliation_queue.sql` — service-role-only queue.
2. `20261101_billing_queue_atomic_claim.sql` — atomic claim with SKIP LOCKED.
3. `20261101_billing_queue_finalize.sql` — idempotent enqueue and lease-fenced completion.

All functions reject calls that are not service_role. Completing a job requires
the exact lease expiry returned by claim and a still-valid processing lease.
A stale worker cannot overwrite the outcome of a newer worker.

These functions are deliberately NOT connected to live webhook processing.
No cron, job worker, checkout, or entitlement activation has been enabled.

## Before enabling
- Apply migrations in a separate approved Sandbox environment.
- Verify provider event IDs are idempotent, with duplicate and concurrent delivery tests.
- Confirm customer-to-user ownership and provider subscription identity.
- Reconcile payment and subscription via Asaas API, not webhook payload.
- Determine valid billing period from authoritative records.
- Test expiration, retry, failed workers, stale leases and recovery.
- Persist paid entitlement and audit transactionally; ensure refunds downgrade safely.
- Verify all tests and only then enable sandbox worker, never production charges.
