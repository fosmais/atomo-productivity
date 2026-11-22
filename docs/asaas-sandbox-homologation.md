# MYRYRA — Asaas Sandbox (MVP1)

The payment provider is Asaas. The legacy Mercado Pago webhook remains dormant.
No real charges are enabled. The checkout route responds 503 without sandbox
configuration and 501 even with sandbox credentials: no payment is created.

## Server-only variables (configure later)
- ASAAS_ENVIRONMENT=sandbox
- ASAAS_API_KEY (sandbox secret; never NEXT_PUBLIC_)
- ASAAS_WEBHOOK_TOKEN (separate random webhook secret)
- BILLING_ENTITLEMENTS_ENABLED (keep false until reconciliation verified)
- BILLING_CHECKOUT_ENABLED (keep false until end-to-end sandbox approval)

## Available read-only APIs
- GET /api/billing/plans — public catalogue, checkoutEnabled false
- GET /api/billing/me — authenticated effective entitlements
- GET /api/billing/subscription — authenticated lifecycle metadata, never exposes provider credentials or other users
- POST /api/billing/checkout — intentionally disabled
- POST /api/billing/asaas/webhook — sandbox-only authenticated audit receipt; no entitlement granting

## Acceptance gates
1. Build and typecheck all endpoints.
2. Verify 401 unauthenticated and 403 for unmet MFA on user-specific APIs.
3. Test plan prices, quotas and Free fallback.
4. Provision Asaas sandbox credentials; create/reuse customer and recurring subscription.
5. Persist provider subscription IDs and payment identifiers idempotently.
6. Independently reconcile verified payment and subscription status with Asaas API.
7. Test duplicates, retries, renewals, cancellations, late payments, refunds, chargebacks.
8. Verify RLS, user isolation, quotas, downgrade and failure handling.
9. Enable checkout only after all tests pass in isolated preview.

Official documentation: https://docs.asaas.com/docs/creating-a-subscription
