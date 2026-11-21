# PR #63 — Journey API mutation authorization review (2026-11-20)

Source-reviewed routes on branch `test/mvp2-pr62-rebase-20261119`:

| Route | Mutation | Auth and owner checks | Privileged write | Residual review |
|---|---|---|---|---|
| `PATCH /api/journeys/[journeyId]` | title, target_date, status | `getUser`, MFA, owner read; admin UPDATE filters `id`, `owner_id`, allowed current statuses | yes | Ensure status transitions and permitted fields remain narrowly validated |
| `DELETE /api/journeys/[journeyId]` | soft archive (`status='archived'`) | same owner filter and status constraints | yes | Physical DELETE is not needed for this route; preserve MYRA history |
| `PATCH /api/journeys/[journeyId]/missions/[missionId]` | mission `completed` / `pending` | `getUser`, MFA, owned journey read and mission-to-journey read; admin UPDATE filters mission ID, journey ID, prior status | yes | Educational assessment policy/lesson/progress must be revalidated against concurrent changes and trigger; server-side update does not repeat explicit owner filter (ownership established in preceding read) |
| `PUT /api/journeys/learning` | save answer and clear stale grade | `getUser`, MFA, owned journey and mission read | yes | CAS on prior answer/updated_at; new answer invalidates assessment; confirm schema parity and race tests |

**Key finding:** the application already routes journey edits/archives and mission status changes through server-side admin writes. Consequently, granting broad direct `authenticated` UPDATE/DELETE privileges solely to make homologation match PROD is **not required by these reviewed routes** and would enlarge the attack surface.

The mission completion route requires an assessment for detected educational missions, checks a saved passing assessment and performs a conditional update; however, the assessment and mutation are separate queries, and server-admin writes bypass RLS. Database trigger protection and authenticated concurrency tests remain essential. A mission's educational classification depends on title matching, assessment policy or linked lesson; test non-template missions and policy absence.

**Recommended next step:** keep direct mission status UPDATE revoked, keep journey physical DELETE revoked, maintain owner-filtered API mutation routes, review any other clients writing directly before changing grants, and add tests for concurrent assessment invalidation and completion. Do not apply DDL until explicitly approved.

No code, schema, permissions or production changes were made by this review.
