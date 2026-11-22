# Política de conciliação Asaas — MYRYRA MVP1

The provider adapters are **read-only**, Sandbox-only, and do not grant access.
Webhook events are audit records, not proof of payment.

Before enabling billing:
- Map the authenticated MYRYRA user to a durable Asaas customer ID.
- Bind subscription ID and plan price server-side, never from a browser claim.
- Verify the subscription belongs to the expected customer.
- Verify the payment belongs to the exact expected subscription and has the
  expected amount/currency and a confirmed received state.
- Verify paid period start/end from provider evidence before granting access.
- Apply database changes atomically, idempotently, and with an audit trail.
- For refunds, overdue, cancellation and chargeback, define explicit downgrade
  rules and test every transition.
- Never grant access based solely on webhook content or a redirect to the site.
- Do not enable BILLING_CHECKOUT_ENABLED until Sandbox journeys are tested.

Asaas API: https://docs.asaas.com/reference/retrieve-a-single-payment
