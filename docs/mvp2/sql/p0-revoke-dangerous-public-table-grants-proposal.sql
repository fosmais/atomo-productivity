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
