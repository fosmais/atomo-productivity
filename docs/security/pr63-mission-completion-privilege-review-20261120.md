# PR #63 — Mission completion privilege review (read-only)

Snapshot 2026-11-20. Source: read-only information_schema.role_table_grants and trigger function definitions from production and homologation. No DDL/DML executed.

## Direct table privileges

| Role / permission | Production | Homologation |
| --- | --- | --- |
| authenticated INSERT | granted | granted |
| authenticated UPDATE | granted | **not granted** |
| authenticated DELETE | granted | granted |
| authenticated SELECT | granted | granted |
| service_role UPDATE (direct grant) | granted | **not granted** |

These are direct catalog grants; role inheritance, RLS, and elevated execution paths require separate verification. Lack of a direct grant is not proof that an entire API operation is impossible.

## Trigger observations

Homologation has an assessed-mission BEFORE INSERT/UPDATE OF status guard requiring persisted passing assessment, minimum score, and latest issued exercise when applicable. It also has a BEFORE INSERT guard that rejects status=completed when current_user is authenticated or anon.

The BEFORE INSERT guard **does not itself reject UPDATE of status to completed**. The assessment guard addresses educational missions, not necessarily all missions. In production the two guards are absent. Production authenticated has direct UPDATE privilege on missions; this is a security-review finding, not evidence that a cross-user or unauthorized update succeeds under RLS.

## Blocking tests

1. Verify actual mission RLS policies and any inherited grants.
2. Use two authenticated test accounts to attempt cross-owner reads, writes, mission status completion and exercise/feedback manipulation; expect denial and no MYRA credits.
3. Test own mission completion via intended server path, unauthorized direct update, direct completed INSERT, and repeated completion; distinguish educational vs non-educational missions.
4. Confirm the expected authorization model for service-role and triggers before considering GRANT/REVOKE or trigger changes.
5. Do not apply migration or release to production without explicit authorization and recorded evidence.
