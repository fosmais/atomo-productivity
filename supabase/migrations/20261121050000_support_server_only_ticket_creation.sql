-- All support ticket creation must use /api/support/submit, which enforces
-- authenticated identity, validation, and per-user rate limits.
-- This follow-up also protects environments where the core migration ran earlier.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.support_tickets FROM authenticated;
DROP POLICY IF EXISTS "Users create own support tickets" ON public.support_tickets;
