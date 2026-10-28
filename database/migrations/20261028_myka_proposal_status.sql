-- MYRYRA 27.14B
-- Executar no Supabase SQL Editor somente apos integrar o backend.

begin;

alter table public.myka_messages
  add column if not exists task_status text not null default 'legacy';

alter table public.myka_messages
  add column if not exists event_status text not null default 'legacy';

alter table public.myka_messages
  add column if not exists confirmed_task_id uuid;

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

create or replace function public.myka_confirm_task(
  p_message_id uuid
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
  v_plan_id uuid;
  v_task_id uuid;
  v_title text;
  v_priority text;
  v_due_date date;
begin
  v_user_id := (select auth.uid());

  if v_user_id is null then
    raise exception 'Usuario nao autenticado';
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

  if v_message.task_status = 'saved' then
    if v_message.confirmed_task_id is null then
      raise exception 'Confirmacao inconsistente';
    end if;

    return query
      select v_message.confirmed_task_id, true;
    return;
  end if;

  if v_message.task_status <> 'pending'
     or v_message.proposed_task is null then
    raise exception 'Tarefa nao disponivel para confirmacao';
  end if;

  v_title := trim(v_message.proposed_task->>'title');
  v_priority := v_message.proposed_task->>'priority';

  if v_title is null or length(v_title) = 0
     or length(v_title) > 500 then
    raise exception 'Titulo da tarefa invalido';
  end if;

  if v_priority not in ('Alta', 'Média', 'Normal')
     or v_priority is null then
    raise exception 'Prioridade invalida';
  end if;

  if nullif(v_message.proposed_task->>'dueDate', '') is not null then
    v_due_date := (v_message.proposed_task->>'dueDate')::date;
  end if;

  insert into public.plans (user_id, title)
  values (v_user_id, 'Tarefas do Concierge')
  returning id into v_plan_id;

  insert into public.tasks (
    plan_id, user_id, title, priority, due_date, completed
  )
  values (
    v_plan_id, v_user_id, v_title, v_priority, v_due_date, false
  )
  returning id into v_task_id;

  update public.myka_messages
     set task_status = 'saved',
         confirmed_task_id = v_task_id
   where id = p_message_id
     and user_id = v_user_id;

  return query select v_task_id, false;
end;
$$;

revoke all on function public.myka_confirm_task(uuid) from public;
revoke all on function public.myka_confirm_task(uuid) from anon;
grant execute on function public.myka_confirm_task(uuid) to authenticated;

-- As mensagens continuarao legiveis pelo proprietario.
-- A escrita sera realizada exclusivamente pelas rotas do servidor.
revoke insert, update, delete
  on table public.myka_messages from authenticated;

commit;