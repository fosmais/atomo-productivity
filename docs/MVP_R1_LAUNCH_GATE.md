# MYRYRA MVP R1 — launch gate (2026-10-30)

## Verified
- [x] AutoPilot reservation persists as MYRYRA Agenda event (manual UI verification).
- [x] PostgreSQL RLS enabled for tasks/events and tested with simulated identities.
- [x] AutoPilot duplicate unique index and rollback-only duplicate RPC test.
- [x] AutoPilot calendar-conflict rejection in rollback-only SQL test.
- [x] Google Calendar connection table has RLS and no direct anon/authenticated SELECT grants.
- [x] Supabase Free retained; leaked-password protection is a Pro-tier feature.

## Blocking validation
- [ ] Prove two truly concurrent authenticated sessions competing for the same task/slot; verify exactly one success and one rejection, with no persisted test data.
- [ ] Run end-to-end browser smoke tests: signup/login, task create/edit, AutoPilot preview/confirm, Agenda reload, Google Calendar connected/disconnected, mobile layout.
- [ ] Check current Preview deployment corresponds to intended GitHub commit; deploy and test updated frontend if needed.
- [ ] Check OpenAI concierge/Copilot API responses and failure handling; never log or expose API keys.
- [ ] Confirm billing, privacy policy, terms, account deletion and data export before paid beta.
- [ ] Validate production custom domain, HTTPS, error monitoring and recovery plan.

## Known limitations / accepted risks
- Supabase Free does not provide leaked-password protection. Enforce strong password requirements and monitor account abuse.
- Supabase security advisor flags intentional SECURITY DEFINER MYKA functions; ownership checks were inspected, but review when code changes.
- Google Calendar external conflict checks occur before DB reservation and are not part of the PostgreSQL transaction; external calendars may change in the interval.
- Do not claim two-session concurrency is verified from sequential SQL or overlapping tool calls.
