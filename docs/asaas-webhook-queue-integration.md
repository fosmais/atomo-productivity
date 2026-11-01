# MYRYRA — Asaas webhook to reconciliation queue

The webhook now optionally enqueues an allowlisted payment event using the
service-role-only `enqueue_asaas_reconciliation_event` RPC.

## Disabled by default
`ASAAS_RECONCILIATION_QUEUE_ENABLED` must be exactly `true`, in addition
to the existing sandbox readiness gate. Do not set it in Preview until the
three staged migrations are reviewed and applied to a dedicated sandbox DB.

## Behavior
- Validate the Asaas token and bound the request body to 32 KiB.
- Record a unique webhook audit receipt.
- For allowlisted payment events, extract and validate `payment.id`.
- Enqueue idempotently through the database function; if unavailable return 503.
- Return 422 for missing payment references on eligible events.
- Non-allowlisted events remain audit-only.
- Never grant paid access from an event or queue acknowledgement.

## Still required before enabling
- Atomic worker execution with ownership checks and provider verification.
- Authoritative paid-period calculation and transactionally persisted entitlements.
- Expired lease recovery, refunds, chargebacks and out-of-order event protection.
- Sandbox end-to-end and concurrency tests.

This integration is intentionally inert without the flag and reviewed migrations.
