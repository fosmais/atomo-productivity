# Asaas reconciliation queue — deployment gate

Migration `20261101_billing_reconciliation_queue.sql` is staged in Git only.
Do not apply to the live Supabase project without a separate review.

Flow once sandbox credentials exist:
1. Verify webhook token and reject oversized bodies.
2. Record the event in `billing_webhook_events` idempotently.
3. For allowlisted payment events, enqueue the payment ID with a unique event key.
4. Worker claims due jobs with an atomic lease; retries are bounded and backoff is applied.
5. Worker retrieves payment AND subscription from Asaas using server-only credentials.
6. Confirm customer ownership, expected plan amount, subscription and paid period.
7. Apply verified state and audit in one transaction; no webhook directly grants access.
8. Test duplicates, concurrent workers, refunds, chargebacks and late notifications.

Current state: steps 1 and 2 exist. Steps 3–8 are **not enabled**.
No scheduled worker, billing database migration, or checkout has been activated.
