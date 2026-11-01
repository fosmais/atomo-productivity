-- Both RPCs check auth.uid() and ownership. Existing RLS policies must remain enabled.
-- Production grants authenticated no UPDATE on myka_messages by default.
grant update (event_status) on public.myka_messages to authenticated;
alter function public.myka_confirm_event(uuid) security invoker;
alter function public.myka_cancel_event(uuid) security invoker;
