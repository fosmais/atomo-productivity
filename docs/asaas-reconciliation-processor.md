# MYRYRA — Reconciliation processor contract

`evaluateQueuedBillingEvent` is an isolated, dependency-injected decision layer.
It does not call the provider, claim a job, write SQL, or grant access.

Preconditions for an actual worker:
- Claim a job atomically using the service-role-only database function.
- Verify provider payment and subscription through the Asaas Sandbox API.
- Establish verified customer-to-user ownership and plan from server-controlled records.
- Construct evidence with a provider-derived valid period and matching price.
- Use the decision result only inside a lease-fenced database transaction.
- Update subscription and audit records atomically; handle late/out-of-order events.
- Recover expired leases safely; reject stale workers and replayed notifications.
- Validate cases with isolated test fixtures and concurrency tests.

The processor's `verified` result is a **candidate decision**, not authorization
to unlock paid features. Payment access is not enabled.
