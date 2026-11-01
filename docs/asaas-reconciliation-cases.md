# MYRYRA — Conciliação e transições (Sandbox)

Pure function: `decidePaidAccess` in `src/lib/billing/reconciliation-policy.ts`.
It does not update the database, process webhooks, or activate a plan.

| Provider evidence | Expected result |
| --- | --- |
| ACTIVE subscription, matching verified payment CONFIRMED, correct amount, valid period | eligible |
| ACTIVE subscription, matching verified payment RECEIVED, correct amount, valid period | eligible |
| PENDING or OVERDUE payment | Free, PAYMENT_UNCONFIRMED |
| REFUNDED payment or chargeback | Free, REVERSED_PAYMENT |
| CANCELED or INACTIVE subscription | Free, SUBSCRIPTION_INACTIVE |
| Different subscription ID | Free, SUBSCRIPTION_MISMATCH |
| Wrong price/currency | Free, AMOUNT_MISMATCH |
| Expired, malformed or implausibly distant period | Free, INVALID_PERIOD |

Before enabling automatic reconciliation, implement verified customer ownership,
payment-to-subscription matching, period determination, atomic persistence, replay
protection, and test fixtures for every row above. Never derive a paid period
solely from a webhook's `paymentDate` or the browser.
