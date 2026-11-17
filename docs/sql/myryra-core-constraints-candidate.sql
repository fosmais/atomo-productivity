-- Candidate only: apply after foundational core table DDL in a fresh isolated DB.
-- Constraint definitions copied from PROD catalog inspection on 2026-11-17.
begin;
do $preflight$
declare t text;
begin
  foreach t in array array['plans','tasks','events','favorites','google_calendar_connections','myka_conversations','myka_messages'] loop
    if to_regclass('public.'||t) is null then
      raise exception 'Required core table public.% is missing',t;
    end if;
  end loop;
  if to_regclass('auth.users') is null then
    raise exception 'auth.users must exist before core foreign keys are installed';
  end if;
end $preflight$;

alter table public.plans
  add constraint plans_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.tasks
  add constraint tasks_plan_id_fkey foreign key (plan_id) references public.plans(id) on delete cascade,
  add constraint tasks_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade,
  add constraint tasks_category_check check (category = any (array['work','family','leisure','health','personal','study']::text[])),
  add constraint tasks_duration_minutes_check check (duration_minutes is null or (duration_minutes >= 5 and duration_minutes <= 1440)),
  add constraint tasks_status_check check (status = any (array['todo','in_progress','waiting','done']::text[]));
alter table public.events
  add constraint events_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade,
  add constraint events_category_check check (category = any (array['work','family','leisure','health','personal','study']::text[])),
  add constraint events_title_length check (char_length(title) between 1 and 200),
  add constraint events_valid_period check (ends_at > starts_at);
alter table public.favorites
  add constraint favorites_event_id_fkey foreign key (event_id) references public.events(id) on delete cascade,
  add constraint favorites_task_id_fkey foreign key (task_id) references public.tasks(id) on delete cascade,
  add constraint favorites_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade,
  add constraint favorites_exactly_one_target check ((task_id is not null) <> (event_id is not null));
alter table public.google_calendar_connections
  add constraint google_calendar_connections_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.myka_conversations
  add constraint myka_conversations_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade,
  add constraint myka_conversations_title_length check (char_length(title) between 1 and 200),
  add constraint myka_conversations_id_user_unique unique (id,user_id);
alter table public.myka_messages
  add constraint myka_messages_conversation_owner_fk foreign key (conversation_id,user_id) references public.myka_conversations(id,user_id) on delete cascade,
  add constraint myka_messages_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade,
  add constraint myka_messages_content_check check (char_length(content) between 1 and 20000),
  add constraint myka_messages_event_status_check check (event_status = any (array['legacy','pending','saved','cancelled']::text[])),
  add constraint myka_messages_role_check check (role = any (array['user','assistant']::text[])),
  add constraint myka_messages_task_status_check check (task_status = any (array['legacy','pending','saved','cancelled']::text[]));
commit;
