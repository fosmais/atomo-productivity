# MYRYRA — Asaas webhook security

- The endpoint is disabled until sandbox secrets and billing flags are configured.
- Requests must provide the configured Asaas access token; comparison is constant-time for equal-length tokens.
- Request bodies are consumed in bounded chunks, rejecting payloads over 32 KiB before loading them fully.
- Event identifiers and event types are syntax-validated.
- A unique database key (provider, provider_event_id) makes event receipts idempotent.
- A receipt is an audit record only: no webhook payload can grant paid access.
- Future work: independently fetch provider data, verify account ownership, reconcile periods, and commit subscription state atomically.
- Verify Asaas webhook retry and response expectations in Sandbox before enabling event processing.
