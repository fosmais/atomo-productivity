# PR #63 — Journey/MYRA RLS policy audit (read-only)

Date: 2026-11-20. Catalog query: pg_policies for public.myryra_journey_missions, public.myryra_journeys and public.myryra_journey_myra_ledger in PROD and homologation. No SQL changes.

## Verified policies

- Both environments: missions SELECT/INSERT/UPDATE/DELETE policies are scoped by EXISTS on the parent journey where owner_id = auth.uid(). UPDATE has both USING and WITH CHECK owner checks.
- Both environments: ledger has authenticated SELECT policy limited to owner_id = auth.uid(); no authenticated INSERT/UPDATE/DELETE policies observed in the queried set.
- Production: journeys have owner-scoped SELECT/INSERT/UPDATE/DELETE policies.
- Homologation: journeys have only owner-scoped SELECT and INSERT policies in this query, with different policy names.
- Previously verified direct grants: PROD authenticated has UPDATE on missions, while homologation authenticated does not. PROD authenticated has DELETE on journeys; homologation authenticated does not.

## Risk and limits

Owner-scoped UPDATE RLS does **not** constrain status transitions or specific columns. In production, authenticated direct UPDATE privilege plus the owner policy makes direct completion of **one's own** mission a plausible bypass of application-level assessment checks; it is not evidence of a successful exploit, and cross-owner updates should remain denied by RLS. Production does not have the two assessed-completion/client-insert guards observed in homologation.

An authenticated owner may also be able to physically delete their own journey in production; the production ledger mission/journey FKs currently cascade, so preserving credits requires a coordinated migration and delete-protection plan. Do not apply changes without authorization.

## Required E2E cases

1. Account A cannot SELECT/UPDATE/DELETE account B's journeys/missions or read B's MYRA credits.
2. Account A cannot create missions in B's journey or change ownership through a journey_id reassignment.
3. Direct authenticated completion of own educational mission without passed assessment must fail; with valid latest assessed exercise, the intended server path should succeed.
4. Direct authenticated completion of own non-educational mission must follow the explicitly approved business rule.
5. Retry completion does not duplicate MYRA credit; physical deletion must not erase earned credits after authorized migration.
6. Verify API route/service-role behavior, role inheritance and policy/grant alignment in both environments.

**Release status:** blocked pending real two-account E2E and production-equivalent rehearsal. PR remains draft. No merge, DDL, migration or deploy authorized.
