-- P0: Remove dangerous table-level privileges from browser-facing roles.
-- Review before production rollout; RLS does NOT protect TRUNCATE.
-- This intentionally leaves SELECT, INSERT, UPDATE, DELETE unchanged.
BEGIN;
REVOKE TRUNCATE, TRIGGER, REFERENCES ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
-- Inspect direct and inherited privileges separately after execution.
-- A successful revoke does not guarantee that a role lacks inherited grants.
COMMIT;

-- Post-deploy verification (must return zero rows for direct grants):
SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND grantee IN ('anon', 'authenticated')
  AND privilege_type IN ('TRUNCATE', 'TRIGGER', 'REFERENCES')
ORDER BY table_name, grantee, privilege_type;

-- Verify EFFECTIVE privileges, including grants inherited through roles or PUBLIC.
-- Must return zero rows after the change (unlike direct-grant inspection alone).
SELECT c.relname AS table_name, role_name, privilege
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
CROSS JOIN (VALUES ('anon'), ('authenticated')) AS roles(role_name)
CROSS JOIN (VALUES ('TRUNCATE'), ('TRIGGER'), ('REFERENCES')) AS privileges(privilege)
WHERE n.nspname = 'public' AND c.relkind IN ('r','p')
  AND has_table_privilege(roles.role_name, c.oid, privileges.privilege)
ORDER BY c.relname, role_name, privilege;

-- Verified PROD baseline on 2026-11-11: 14/60 public tables effectively
-- allow anon TRUNCATE; 31/60 allow authenticated TRUNCATE.
-- Neither role is a member of the other. TRIGGER counts are also 14/31.
-- Do not claim deployment success until the effective-privilege query returns zero.
