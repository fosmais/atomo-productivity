# Asaas reconciliation queue — deployment gate

Migration `20261101_billing_reconciliation_queue.sql` is staged in Git only.
Do not apply to the live Supabase project without a separate review.

## Proposed flow
1. Verify webhook token and reject oversized bodies.
2. Record the event in `billing_webhook_events` idempotently.
3. For allowlisted payment events, enqueue the payment ID with a unique event key.
4. Worker atomically leases due jobs (transactional claim); never process unleased jobs.
5. Retrieve payment AND subscription directly from Asaas with server-only credentials.
6. Verify customer ownership, subscription, amount, payment status, and period.
7. Persist subscription state and audit in a single transaction with replay protection.
8. Handle refunds, late notifications and chargebacks; verify all transitions in Sandbox.

## Scheduling policy
`src/lib/billing/reconciliation-queue.ts` defines a pure retry policy:
- Provider failures, unconfirmed payments and unexpected failures retry at 1, 2, 4, 8, 16, 32, 64 minutes, up to 8 attempts.
- Invalid events and ownership mismatches are permanently rejected.
- A maximum delay of 6 hours is enforced.
- Already verified/rejected/processing jobs cannot be picked up as due jobs.

The scheduler **does not** perform database writes, claim locks, or execute jobs.
Current state: steps 1 and 2 exist. Steps 3–8 are **not enabled**.
No scheduled worker, database migration, or checkout has been activated.
