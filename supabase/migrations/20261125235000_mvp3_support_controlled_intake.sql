-- Require server-side rate-limited support intake; retain owner read access.
revoke insert on public.support_tickets from authenticated;
