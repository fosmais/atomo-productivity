-- Recovered and tested staging schema. Review before applying; do not run against existing production table.
begin;
create table public.mika_agent_actions (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  event_id uuid,
  service text not null,
  action_type text not null,
  status text not null default 'proposed'::text,
  provider text,
  proposal jsonb not null default '{}'::jsonb,
  authorization_at timestamp with time zone,
  authorization_scope jsonb,
  execution_started_at timestamp with time zone,
  execution_finished_at timestamp with time zone,
  provider_reference text,
  result jsonb,
  error_code text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint mika_agent_actions_authorization_before_execution CHECK (((execution_started_at IS NULL) OR (execution_started_at >= authorization_at))),
  constraint mika_agent_actions_authorized_requires_time CHECK (((status <> ALL (ARRAY['authorized'::text, 'executing'::text, 'succeeded'::text])) OR (authorization_at IS NOT NULL))),
  constraint mika_agent_actions_executing_requires_start CHECK (((status <> 'executing'::text) OR (execution_started_at IS NOT NULL))),
  constraint mika_agent_actions_execution_requires_authorization CHECK (((execution_started_at IS NULL) OR (authorization_at IS NOT NULL))),
  constraint mika_agent_actions_finished_after_started CHECK (((execution_finished_at IS NULL) OR ((execution_started_at IS NOT NULL) AND (execution_finished_at >= execution_started_at)))),
  constraint mika_agent_actions_pkey PRIMARY KEY (id),
  constraint mika_agent_actions_service_check CHECK ((service = ANY (ARRAY['transport'::text, 'restaurant'::text, 'parking'::text, 'hotel'::text, 'external_app'::text, 'other'::text]))),
  constraint mika_agent_actions_status_check CHECK ((status = ANY (ARRAY['proposed'::text, 'awaiting_authorization'::text, 'authorized'::text, 'executing'::text, 'succeeded'::text, 'failed'::text, 'cancelled'::text, 'expired'::text]))),
  constraint mika_agent_actions_success_requires_execution CHECK (((status <> 'succeeded'::text) OR ((authorization_at IS NOT NULL) AND (execution_started_at IS NOT NULL) AND (execution_finished_at IS NOT NULL) AND (result IS NOT NULL)))),
  constraint mika_agent_actions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);
CREATE INDEX mika_agent_actions_user_created_idx ON public.mika_agent_actions USING btree (user_id, created_at DESC);
CREATE UNIQUE INDEX mika_agent_concierge_one_active_per_event_idx ON public.mika_agent_actions USING btree (user_id, event_id) WHERE ((action_type = 'concierge_planning'::text) AND (event_id IS NOT NULL) AND (status = ANY (ARRAY['awaiting_authorization'::text, 'authorized'::text, 'executing'::text])));
alter table public.mika_agent_actions enable row level security;
revoke all on public.mika_agent_actions from public,anon,authenticated;
grant select on public.mika_agent_actions to authenticated;
grant all on public.mika_agent_actions to service_role;
create policy mika_agent_actions_select_own on public.mika_agent_actions for select to authenticated using ((select auth.uid())=user_id);
CREATE OR REPLACE FUNCTION public.mika_agent_action_transition_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
 if new.user_id is distinct from old.user_id or new.id is distinct from old.id or new.event_id is distinct from old.event_id then
  raise exception 'Action identity and event are immutable' using errcode='23514';
 end if;
 if old.authorization_at is not null and (new.authorization_at is distinct from old.authorization_at or new.authorization_scope is distinct from old.authorization_scope) then
  raise exception 'Authorization record is immutable' using errcode='23514';
 end if;
 if old.status in ('authorized','executing','succeeded','failed','cancelled','expired')
    and (new.proposal is distinct from old.proposal or new.service is distinct from old.service
    or new.provider is distinct from old.provider or new.action_type is distinct from old.action_type) then
  raise exception 'Approved action details are immutable' using errcode='23514';
 end if;
 if old.status in ('succeeded','failed','cancelled','expired') and (
  new.result is distinct from old.result or new.provider_reference is distinct from old.provider_reference
  or new.execution_started_at is distinct from old.execution_started_at
  or new.execution_finished_at is distinct from old.execution_finished_at
  or new.error_code is distinct from old.error_code
 ) then
  raise exception 'Terminal execution record is immutable' using errcode='23514';
 end if;
 if new.status is distinct from old.status and not (
   (old.status='proposed' and new.status in ('awaiting_authorization','cancelled','expired'))
   or (old.status='awaiting_authorization' and new.status in ('authorized','cancelled','expired'))
   or (old.status='authorized' and new.status in ('executing','cancelled','expired'))
   or (old.status='executing' and new.status in ('succeeded','failed'))
 ) then
  raise exception 'Invalid action state transition: % to %',old.status,new.status using errcode='23514';
 end if;
 return new;
end $function$
;
CREATE OR REPLACE FUNCTION public.mika_agent_authorization_snapshot()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
 if old.status = 'awaiting_authorization' and new.status = 'authorized' then
   new.authorization_scope := jsonb_build_object(
     'approved',true,
     'service',new.service,
     'action_type',new.action_type,
     'provider',new.provider,
     'event_id',new.event_id,
     'proposal',new.proposal
   );
 end if;
 return new;
end $function$
;
revoke execute on function public.mika_agent_action_transition_guard(),public.mika_agent_authorization_snapshot() from public,anon,authenticated;
create trigger mika_agent_action_transition_guard before update on public.mika_agent_actions for each row execute function public.mika_agent_action_transition_guard();
create trigger zz_mika_agent_authorization_snapshot before update on public.mika_agent_actions for each row execute function public.mika_agent_authorization_snapshot();
commit;
