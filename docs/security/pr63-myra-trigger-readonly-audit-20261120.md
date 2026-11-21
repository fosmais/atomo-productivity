# PR #63 — MYRA trigger security baseline (read-only)

Snapshot: 2026-11-20. Source: read-only PostgreSQL catalog queries against production and MVP2 homologation. No writes performed.

| Control | Production | Homologation |
| --- | --- | --- |
| myryra_credit_completed_mission() owner | postgres | postgres |
| SECURITY DEFINER | true | true |
| search_path | empty | empty |
| anon direct EXECUTE | false | false |
| authenticated direct EXECUTE | false | false |
| AFTER INSERT OR UPDATE OF status trigger myryra_mission_credit_myra | present | present |
| BEFORE assessed completion guard | absent | present |
| BEFORE client-completed insertion guard | absent | present |

**Interpretation:** Function-level EXECUTE grants are not a substitute for checking trigger invocation paths and row-level permissions. The additional homologation guards mean its security behavior differs from production. Do not infer the production guards are deployed.

**Release gates:** Compare source and deployment ordering of the two guards; confirm no unintended direct mission-completion bypass via authenticated APIs, verify two-account ownership isolation and idempotence, then rehearse in a production-equivalent isolated environment. No schema writes, migrations, merge or production deploy without explicit approval.

Verification queries (read-only):

```sql
SELECT p.proname, pg_get_userbyid(p.proowner) AS function_owner,
       p.prosecdef AS security_definer, p.proconfig,
       has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
       has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname='myryra_credit_completed_mission';
```

```sql
SELECT c.relname AS table_name, t.tgname AS trigger_name,
       pg_get_triggerdef(t.oid) AS definition
FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname='myryra_journey_missions'
AND NOT t.tgisinternal ORDER BY t.tgname;
```
