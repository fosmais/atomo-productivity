# MYRYRA MVP1 — MIKA Financial Care (implementation contract)

Status: design approved for sandbox development; **not deployed**, no live billing writes.

## Customer-facing operations
- **Cancel renewal:** authenticated user may request cancellation; show current plan, next charge, end of paid period and confirmation. Record intent and a unique operation key. Only mark cancellation complete after verified Asaas response and durable DB transaction. Do not revoke already paid access prematurely.
- **Downgrade:** choose lower plan, show effective date at end of current paid period and price difference. Confirm before scheduling. Avoid immediate reduction of paid entitlements.
- **Refund request:** create a support ticket, show policy and protocol; never promise or automatically execute a refund without policy/authorization checks. Route disputes, suspected fraud and ambiguous payments to a human.
- **Refund tracking:** expose verified provider status for the authenticated payment owner; distinguish requested, under review, submitted, processed, and settled.
- **MIKA and subscription panel:** offer identical authenticated operations; chat must not be the only cancellation channel.

## Security / integrity
1. Read identity from Supabase auth server-side, never from request body; enforce MFA where configured.
2. Check subscription and payment ownership against provider IDs stored server-side.
3. Require explicit, transaction-specific confirmation before any change; no free-form LLM tool execution of financial mutations.
4. Idempotency key and durable operation log; provider timeouts must enter needs_recovery, not blindly retry.
5. Verify Asaas authoritative subscription/payment state before updating entitlements; webhook alone is not proof.
6. Store audit trail: user ID, operation, old/new plan, effective date, provider IDs, actor, timestamps, state and sanitized error.
7. Keep all provider writes behind sandbox flags until end-to-end tests pass. Never log API secrets or payment credentials.
8. For a cancellation, distinguish cancellation of future renewal from refund of prior charge; disclose that these are separate actions.

## Test matrix
- Cancel active subscription; repeat same request; concurrent requests; provider timeout; late webhook; already canceled.
- Downgrade at cycle boundary; future plan scheduled; renewal races; unpaid invoice; refund after downgrade.
- Refund request for valid own payment; foreign payment; duplicate charge; partially refunded; expired eligibility; chargeback.
- Auth missing, stale session, MFA required, cross-user access, malicious LLM instructions.
- Confirm access persists until verified paid period end; failed/refunded payments downgrade only under explicit policy.

## Existing repository constraints
- `src/app/api/billing/subscription/route.ts` is read-only.
- `src/lib/billing/asaas.ts` supports sandbox GET and restricted POST only; it does **not** currently support cancellation or refund mutation.
- Reconciliation queue migrations and worker activation require separate sandbox validation.
- Do not advertise cancellation/refunds as operational until provider integration, database transaction and tests are complete.

## Next engineering block
Implement server-only sandbox operations + persisted intent state; then authenticated endpoints and UI confirmation, followed by test harness. No production charges.
