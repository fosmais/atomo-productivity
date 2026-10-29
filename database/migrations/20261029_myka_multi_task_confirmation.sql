-- MYRYRA 27.15K
-- Confirmacao individual e idempotente de tarefas.
-- Executar no Supabase somente apos revisao final.

begin;

alter table public.myka_messages
  add column if not exists task_status text not null default 'legacy';

alter table public.myka_messages
  add column if not exists event_status text not null default 'legacy';

alter table public.myka_messages
  drop constraint if exists myka_messages_task_status_check;

alter table public.myka_messages
  add constraint myka_messages_task_status_check
  check (task_status in ('legacy', 'pending', 'saved', 'cancelled'));

alter table public.myka_messages
  drop constraint if exists myka_messages_event_status_check;

alter table public.myka_messages
  add constraint myka_messages_event_status_check
  check (event_status in ('legacy', 'pending', 'saved', 'cancelled'));

-- Proteger propostas geradas pela Myka contra escrita direta.
-- A API de servidor deve usar credenciais com permissoes adequadas.
revoke insert, update, delete on public.myka_messages
  from authenticated;

revoke insert, update, delete on public.myka_messages
  from anon;
create table if not exists public.myka_task_confirmations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  message_id uuid not null references public.myka_messages(id) on delete cascade,
  task_index integer not null check (task_index between 0 and 9),
  task_id uuid references public.tasks(id) on delete set null,
  decision text not null check (decision in ('saved', 'cancelled')),
  constraint myka_task_decision_consistency check (
    (decision = 'saved')
    or (decision = 'cancelled' and task_id is null)
  ),
  created_at timestamptz not null default now(),
  unique (message_id, task_index)
);

create index if not exists myka_task_confirmations_user_idx
  on public.myka_task_confirmations(user_id);

alter table public.myka_task_confirmations enable row level security;

revoke all on public.myka_task_confirmations from anon;
revoke all on public.myka_task_confirmations from authenticated;
grant select on public.myka_task_confirmations to authenticated;

drop policy if exists myka_task_confirmations_select
  on public.myka_task_confirmations;

create policy myka_task_confirmations_select
  on public.myka_task_confirmations
  for select to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.myka_confirm_task_item(
  p_message_id uuid,
  p_task_index integer
)
returns table (
  task_id uuid,
  already_saved boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_message public.myka_messages%rowtype;
  v_existing_task_id uuid;
  v_existing_decision text;
  v_proposal jsonb;
  v_plan_id uuid;
  v_task_id uuid;
  v_title text;
  v_priority text;
  v_due_date date;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Usuario nao autenticado';
  end if;

  if p_task_index is null or p_task_index < 0 or p_task_index > 9 then
    raise exception 'Indice de tarefa invalido';
  end if;

  select *
    into v_message
    from public.myka_messages m
   where m.id = p_message_id
     and m.user_id = v_user_id
     and m.role = 'assistant'
   for update;

  if not found then
    raise exception 'Mensagem nao encontrada';
  end if;

  select c.task_id, c.decision
    into v_existing_task_id, v_existing_decision
    from public.myka_task_confirmations c
   where c.message_id = p_message_id
     and c.task_index = p_task_index
     and c.user_id = v_user_id;

  if found then
    if v_existing_decision = 'cancelled' then
      raise exception 'Esta tarefa foi descartada';
    end if;
    return query select v_existing_task_id, true;
    return;
  end if;

  if v_message.task_status <> 'pending' then
    raise exception 'Proposta indisponivel para confirmacao';
  end if;

  if v_message.proposed_task is null then
    raise exception 'Mensagem sem propostas de tarefas';
  end if;

  if jsonb_typeof(v_message.proposed_task) = 'array' then
    if p_task_index >= jsonb_array_length(v_message.proposed_task) then
      raise exception 'Tarefa nao encontrada na lista';
    end if;

    v_proposal := v_message.proposed_task -> p_task_index;
  elsif jsonb_typeof(v_message.proposed_task) = 'object'
        and p_task_index = 0 then
    v_proposal := v_message.proposed_task;
  else
    raise exception 'Formato ou indice de tarefa invalido';
  end if;

  if jsonb_typeof(v_proposal) <> 'object' then
    raise exception 'Proposta de tarefa invalida';
  end if;

  v_title := trim(v_proposal ->> 'title');
  v_priority := v_proposal ->> 'priority';

  if v_title is null or length(v_title) = 0
     or length(v_title) > 200 then
    raise exception 'Titulo invalido';
  end if;

  if v_priority is null
     or v_priority not in ('Alta', 'Média', 'Normal') then
    raise exception 'Prioridade invalida';
  end if;

  if nullif(v_proposal ->> 'dueDate', '') is not null then
    v_due_date := (v_proposal ->> 'dueDate')::date;
  end if;

  insert into public.plans (user_id, title)
  values (v_user_id, 'Tarefas da Myka')
  returning id into v_plan_id;

  insert into public.tasks (
    plan_id, user_id, title, priority, due_date, completed
  )
  values (
    v_plan_id, v_user_id, v_title, v_priority, v_due_date, false
  )
  returning id into v_task_id;

  insert into public.myka_task_confirmations (
    user_id, message_id, task_index, task_id, decision
  )
  values (
    v_user_id, p_message_id, p_task_index, v_task_id, 'saved'
  );

  return query select v_task_id, false;
end;
$$;

create or replace function public.myka_cancel_task_item(
  p_message_id uuid,
  p_task_index integer
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_message public.myka_messages%rowtype;
  v_existing_decision text;
  v_proposal jsonb;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Usuario nao autenticado';
  end if;

  if p_task_index is null or p_task_index < 0 or p_task_index > 9 then
    raise exception 'Indice invalido';
  end if;

  select *
    into v_message
    from public.myka_messages m
   where m.id = p_message_id
     and m.user_id = v_user_id
     and m.role = 'assistant'
   for update;

  if not found then
    raise exception 'Mensagem nao encontrada';
  end if;

  select c.decision
    into v_existing_decision
    from public.myka_task_confirmations c
   where c.message_id = p_message_id
     and c.task_index = p_task_index
     and c.user_id = v_user_id;

  if found then
    if v_existing_decision = 'saved' then
      raise exception 'Tarefa ja confirmada';
    end if;
    return 'cancelled';
  end if;

  if v_message.task_status <> 'pending' then
    raise exception 'Proposta indisponivel';
  end if;

  if jsonb_typeof(v_message.proposed_task) = 'array' then
    if p_task_index >= jsonb_array_length(v_message.proposed_task) then
      raise exception 'Indice fora da lista';
    end if;
    v_proposal := v_message.proposed_task -> p_task_index;
  elsif jsonb_typeof(v_message.proposed_task) = 'object'
        and p_task_index = 0 then
    v_proposal := v_message.proposed_task;
  else
    raise exception 'Proposta invalida';
  end if;

  if jsonb_typeof(v_proposal) <> 'object' then
    raise exception 'Tarefa invalida';
  end if;

  insert into public.myka_task_confirmations (
    user_id, message_id, task_index, task_id, decision
  )
  values (
    v_user_id, p_message_id, p_task_index, null, 'cancelled'
  );

  return 'cancelled';
end;
$$;

revoke all on function public.myka_cancel_task_item(uuid, integer)
  from public;

revoke all on function public.myka_cancel_task_item(uuid, integer)
  from anon;

grant execute on function public.myka_cancel_task_item(uuid, integer)
  to authenticated;

revoke all on function public.myka_confirm_task_item(uuid, integer)
  from public;

revoke all on function public.myka_confirm_task_item(uuid, integer)
  from anon;

grant execute on function public.myka_confirm_task_item(uuid, integer)
  to authenticated;

commit;