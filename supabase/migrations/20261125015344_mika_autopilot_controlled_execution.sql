alter table public.mika_autopilot_approvals add column execution_status text not null default 'pending' check (execution_status in ('pending','executed')), add column executed_at timestamptz, add column executed_event_ids uuid[] not null default '{}';
create or replace function public.execute_mika_autopilot_approval(p_approval_id uuid,p_user_id uuid)
returns table(event_ids uuid[])
language plpgsql
security definer
set search_path = ''
as $$
declare
  approval public.mika_autopilot_approvals%rowtype;
  slot jsonb;
  task_row public.tasks%rowtype;
  slot_start timestamptz;
  slot_end timestamptz;
  duration integer;
  new_event_id uuid;
  created_ids uuid[] := '{}';
begin
  select * into approval from public.mika_autopilot_approvals where id=p_approval_id and user_id=p_user_id for update;
  if not found then raise exception 'APPROVAL_NOT_FOUND' using errcode='P0002'; end if;
  if approval.execution_status <> 'pending' then
    if approval.execution_status='executed' then return query select approval.executed_event_ids; return; end if;
    raise exception 'APPROVAL_NOT_PENDING' using errcode='P0001';
  end if;
  if approval.expires_at <= pg_catalog.now() then raise exception 'APPROVAL_EXPIRED' using errcode='P0001'; end if;
  if pg_catalog.jsonb_typeof(approval.slots)<>'array' or pg_catalog.jsonb_array_length(approval.slots)=0 then raise exception 'INVALID_APPROVAL_SLOTS' using errcode='22023'; end if;
  for slot in select value from pg_catalog.jsonb_array_elements(approval.slots) loop
    if not (slot ? 'id' and slot ? 'start' and slot ? 'end') then raise exception 'INVALID_SLOT' using errcode='22023'; end if;
    select * into task_row from public.tasks where id=(slot->>'id')::uuid and user_id=p_user_id for update;
    if not found or task_row.completed or task_row.deleted_at is not null or task_row.due_date is not null or task_row.status not in ('todo','in_progress') then raise exception 'TASK_NOT_ELIGIBLE' using errcode='P0001'; end if;
    slot_start := pg_catalog.to_timestamp((slot->>'start')::double precision/1000);
    slot_end := pg_catalog.to_timestamp((slot->>'end')::double precision/1000);
    duration := coalesce(task_row.duration_minutes,25);
    if slot_start <= pg_catalog.now() or slot_end <= slot_start or slot_end-slot_start <> duration * interval '1 minute' then raise exception 'SLOT_INVALID_OR_EXPIRED' using errcode='P0001'; end if;
    if exists(select 1 from public.events e where e.user_id=p_user_id and e.deleted_at is null and e.blocks_time=true and e.starts_at<slot_end and e.ends_at>slot_start) then raise exception 'SLOT_OCCUPIED' using errcode='P0001'; end if;
    if exists(select 1 from pg_catalog.unnest(created_ids) as prior_id join public.events e on e.id=prior_id where e.starts_at<slot_end and e.ends_at>slot_start) then raise exception 'APPROVED_SLOTS_OVERLAP' using errcode='P0001'; end if;
    insert into public.events(user_id,title,starts_at,ends_at,event_type,blocks_time,category,notes)
    values(p_user_id,task_row.title,slot_start,slot_end,'appointment',true,task_row.category,'Criado pela MIKA AutoPilot após autorização explícita.')
    returning id into new_event_id;
    created_ids := pg_catalog.array_append(created_ids,new_event_id);
  end loop;
  update public.mika_autopilot_approvals set execution_status='executed',executed_at=pg_catalog.now(),executed_event_ids=created_ids where id=p_approval_id and user_id=p_user_id;
  return query select created_ids;
end;
$$;
revoke all on function public.execute_mika_autopilot_approval(uuid,uuid) from public,anon,authenticated;
grant execute on function public.execute_mika_autopilot_approval(uuid,uuid) to service_role;
