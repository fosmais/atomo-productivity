# MYRYRA MVP1 — Release QA gate

Status: **NOT APPROVED FOR PRODUCTION** until every blocking check is evidenced.

## Automated / database checks already executed
- Preview build of commit `d0308fa`: READY (local-day rollover refresh). Previous event-title validation `d128e39`: READY.
- Preview HTTP GET `/`, `/login`, `/dashboard`: 200. This is **not** an authenticated UI test.
- Simulated RLS SQL checks: cross-user SELECT, UPDATE, DELETE for plans/tasks/events; cross-user INSERT for plans/tasks/events. All passed with transaction ROLLBACK.
- Same-user SQL transaction: create plan + task, update task, delete plan and verify cascading task deletion; passed with ROLLBACK.
- Runtime Preview error/fatal log query: none found during checked hour. This is **not** proof of absence of client errors.
- Same-user event create/update/read/delete transaction: passed with ROLLBACK.
- Overnight event overlap query (23:30–01:30 local): passed with ROLLBACK. UI display still untested.
- SQL `ILIKE` literal `%`, literal `_`, wildcard nonmatch and case-insensitivity: passed. UI search still untested.
- Simulated AAL1 versus AAL2 owner-plan reads: equal access. This is an observed policy behavior, not an MFA security sign-off.

## BLOCKING: authenticated end-to-end tests (not yet run)
Use two dedicated nonproduction test accounts with separate sessions, and test **Preview** only:
1. Log in/out and reload; verify session behavior and unauthorized route handling.
2. Quick capture: one task, multiline batch, edit draft, due date and priority; verify saved state after reload.
3. Calendar: create, edit, delete events; verify day/week/month and midnight-spanning events.
4. My Day: due today, overdue, completed, tomorrow, refresh after edits.
5. Global search: exact, accents, literal `%`, `_`, `\\`, more than 30 results, navigation.
6. Plans: create, edit, delete and confirm tasks disappear; verify rollback/error states.
7. User A must not see, update, create for, or delete user B's records via UI/API; test real sessions.
8. MFA assurance checks for protected Google Calendar actions, and Google OAuth refresh/reconnect.
9. Responsive viewport and accessibility keyboard navigation; review console/network errors.
10. Performance with representative large test data, including >500 plans/tasks/events.

## BLOCKING: environment and release decisions
- Google OAuth secrets/config are currently scoped to an older Preview branch. Validate branch-scoped environment before Google E2E; do not print or replace secrets.
- Run MFA/RLS staging release-gate scripts only in an appropriate test environment; do not run destructive staging scripts in the current database.
- Review proposed foreign-key indexes in `database/maintenance/mvp1_fk_indexes_proposal.sql` before any database changes.
- Verify billing entitlements stay disabled and test billing/webhook paths in sandbox.
- Require explicit production approval after signed-off E2E, security, and performance evidence.

No new MVP1 features. Do not interpret a READY build as full QA sign-off.
