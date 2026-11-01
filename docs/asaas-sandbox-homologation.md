# MYRYRA — Asaas Sandbox (MVP1)

Provider selected: Asaas. The Mercado Pago implementation remains in
`src/app/api/billing/mercadopago/webhook/route.ts` as dormant reference.
The active checkout endpoint is intentionally non-operational (HTTP 501 in
sandbox; HTTP 503 otherwise) until the complete payment lifecycle is tested.

## Required server-side configuration
- `ASAAS_ENVIRONMENT=sandbox` (never production for MVP1 testing)
- `ASAAS_API_KEY` (Sandbox credential; never NEXT_PUBLIC_)
- `ASAAS_WEBHOOK_TOKEN` (separate webhook authentication token)
- `BILLING_ENTITLEMENTS_ENABLED=true` only in isolated test environment
- Keep `BILLING_CHECKOUT_ENABLED=false` until payment workflow is complete.

## Acceptance tests before enabling checkout
1. Authenticate a user and validate MFA; reject cross-account access.
2. Create/reuse an Asaas customer with durable user-to-customer mapping.
3. Create monthly subscription in Sandbox and persist provider ID atomically.
4. Validate webhook authentication, duplicates and retry delivery.
5. Independently fetch provider subscription AND payment status; never trust
   the webhook body to grant paid entitlements.
6. Handle renewal, cancellation, overdue payments, refunds and chargebacks.
7. Validate RLS, quotas, failure handling and safe downgrade.
8. Test all journeys with Sandbox credentials; only then review production rollout.

References:
https://docs.asaas.com/docs/creating-a-subscription
https://docs.asaas.com/docs/about-webhooks
