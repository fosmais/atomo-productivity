# MVP2 — Supabase security audit (2026-11-21)

Scope: read-only security advisor and SQL inspection of production project. No migrations or configuration changes executed.

## Findings
- Security advisor: 19 tables with RLS enabled but no policies. These are often intentionally server-only; verify grants and API access before classifying as exposure. Relevant support tables include `support_admins`, `support_email_outbox`, `support_ticket_events`, and `support_ticket_replies`.
- Three authenticated-callable SECURITY DEFINER RPCs: `mika_consume_ai_quota`, `myka_cancel_task_item`, `myka_confirm_task_item`. Their inspected definitions require `auth.uid()`; task RPCs additionally require ownership of the assistant message and validate the task index. These are intentional client features, so do **not** revoke EXECUTE without testing the calling flows. Assess least privilege and rate limits separately.
- Supabase Auth leaked-password protection disabled. Enable through Auth configuration after reviewing operational impact.
- `support_tickets` has a legacy INSERT policy for authenticated users. The pending server-only migration drops it and revokes write grants. Its SELECT policy is scoped to `auth.uid() = user_id`.
- `support_email_outbox` has no `processing_started_at` and its event-type constraint does not yet include `ticket_acknowledgement`. Pending migration adds these.

## Acceptance criteria
1. Isolated Supabase branch: apply pending migrations in order; verify schema constraints and role grants.
2. Two distinct authenticated test users: confirm ticket SELECT isolation, deny direct INSERT, and reject cross-user reply API requests (403/404).
3. Concurrent submissions: demonstrate the 5/hour and 10/day throttle cannot be bypassed; current application-side count-then-insert is **not atomic** and needs remediation before launch.
4. Concurrent email workers: only the owner of the active lease may finalize a row; verify retry and stale lease behavior with synthetic messages.
5. Validate MIKA AI only after explicit per-ticket consent and current legal acceptance; billing requests must remain human-only.
6. Re-run Supabase security advisors after migrations; review intentional server-only RLS tables and privileged RPCs.
7. Confirm production email/AI flags remain disabled until full acceptance and controlled rollout.

## Official remediation references
- RLS enabled without policy: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy
- Authenticated SECURITY DEFINER: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
- Password protection: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
