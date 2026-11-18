-- Isolated candidate reconstructed from PROD pg_policies on 2026-11-17.
-- Apply ONLY to fresh tables after foundational schema/constraints.
-- google_calendar_connections intentionally has RLS enabled and zero client policies.
begin;
do $preflight$
declare t text;
begin
  foreach t in array array['plans','tasks','events','favorites','google_calendar_connections','myka_conversations','myka_messages'] loop
    if to_regclass('public.'||t) is null then raise exception 'Missing table public.%',t; end if;
  end loop;
  if to_regprocedure('auth.uid()') is null then raise exception 'Missing auth.uid()'; end if;
end $preflight$;
alter table public.plans enable row level security;
alter table public.tasks enable row level security;
alter table public.events enable row level security;
alter table public.favorites enable row level security;
alter table public.google_calendar_connections enable row level security;
alter table public.myka_conversations enable row level security;
alter table public.myka_messages enable row level security;

create policy plans_select_own on public.plans for select to authenticated using (user_id=(select auth.uid()));
create policy plans_insert_own on public.plans for insert to authenticated with check (user_id=(select auth.uid()));
create policy plans_update_own on public.plans for update to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
create policy plans_delete_own on public.plans for delete to authenticated using (user_id=(select auth.uid()));

create policy tasks_select_own on public.tasks for select to authenticated using (user_id=(select auth.uid()) and exists(select 1 from public.plans p where p.id=tasks.plan_id and p.user_id=(select auth.uid())));
create policy tasks_insert_own on public.tasks for insert to authenticated with check (user_id=(select auth.uid()) and exists(select 1 from public.plans p where p.id=tasks.plan_id and p.user_id=(select auth.uid())));
create policy tasks_update_own on public.tasks for update to authenticated using (user_id=(select auth.uid()) and exists(select 1 from public.plans p where p.id=tasks.plan_id and p.user_id=(select auth.uid()))) with check (user_id=(select auth.uid()) and exists(select 1 from public.plans p where p.id=tasks.plan_id and p.user_id=(select auth.uid())));
create policy tasks_delete_own on public.tasks for delete to authenticated using (user_id=(select auth.uid()) and exists(select 1 from public.plans p where p.id=tasks.plan_id and p.user_id=(select auth.uid())));

create policy "Users can read own events" on public.events for select to authenticated using ((select auth.uid())=user_id);
create policy "Users can insert own events" on public.events for insert to authenticated with check ((select auth.uid())=user_id);
create policy "Users can update own events" on public.events for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy "Users can delete own events" on public.events for delete to authenticated using ((select auth.uid())=user_id);
create policy events_owner_update_category on public.events for update to authenticated using ((select auth.uid())=user_id and deleted_at is null) with check ((select auth.uid())=user_id and deleted_at is null);

create policy favorites_select_own on public.favorites for select to authenticated using ((select auth.uid())=user_id);
create policy favorites_delete_own on public.favorites for delete to authenticated using ((select auth.uid())=user_id);
create policy favorites_insert_owned_target on public.favorites for insert to authenticated with check (
 (select auth.uid())=user_id and (
 (task_id is not null and exists(select 1 from public.tasks t where t.id=favorites.task_id and t.user_id=(select auth.uid())))
 or (event_id is not null and exists(select 1 from public.events e where e.id=favorites.event_id and e.user_id=(select auth.uid())))
 ));

create policy myka_conversations_select_own on public.myka_conversations for select to authenticated using ((select auth.uid())=user_id);
create policy myka_conversations_insert_own on public.myka_conversations for insert to authenticated with check ((select auth.uid())=user_id);
create policy myka_conversations_update_own on public.myka_conversations for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy myka_conversations_delete_own on public.myka_conversations for delete to authenticated using ((select auth.uid())=user_id);

create policy myka_messages_select_own on public.myka_messages for select to authenticated using ((select auth.uid())=user_id);
create policy myka_messages_insert_own on public.myka_messages for insert to authenticated with check ((select auth.uid())=user_id);
create policy myka_messages_update_own on public.myka_messages for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy myka_messages_delete_own on public.myka_messages for delete to authenticated using ((select auth.uid())=user_id);
commit;
