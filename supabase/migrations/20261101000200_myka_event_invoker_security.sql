-- Requires existing owner-scoped RLS policies on events and myka_messages.
-- Both functions already enforce auth.uid() ownership checks.
alter function public.myka_confirm_event(uuid) security invoker;
alter function public.myka_cancel_event(uuid) security invoker;
