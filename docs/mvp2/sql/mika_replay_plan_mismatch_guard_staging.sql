-- Applied to isolated staging project xanavauqzsrgvdfhcrsm on 2026-11-11.
-- Preserve the original SECURITY DEFINER function and existing grants.
-- Guard idempotent replays against a mismatched approved plan.
do $migration$
declare
  v_definition text;
  v_old text := $old$ if p.status='executed' and p.action_type='create_task' then
   return query select 'already_executed'::text,(p.result->>'task_id')::uuid;
   return;
 end if;$old$;
  v_new text := $new$ if p.status='executed' and p.action_type='create_task' then
   if p.payload->>'plan_id' is null
      or p_plan_id is distinct from (p.payload->>'plan_id')::uuid then
     raise exception 'plan_mismatch' using errcode='22023';
   end if;
   return query select 'already_executed'::text,(p.result->>'task_id')::uuid;
   return;
 end if;$new$;
begin
  v_definition := pg_get_functiondef('public.mika_execute_approved_task(uuid,uuid)'::regprocedure);
  if position(v_old in v_definition)=0 then
    raise exception 'Expected function definition differs; no migration applied';
  end if;
  execute replace(v_definition,v_old,v_new);
end;
$migration$;
