-- MIKA Insights: regression test for saved-plan lifecycle and row-level isolation.
-- PREVIEW ONLY. Requires at least two users in auth.users.
-- All mutations are rolled back; no test data is retained.
begin;
do $$
declare
  owner_id uuid;
  other_id uuid;
  idea_id uuid;
  sample_plan jsonb := '{"tasks":[{"title":"Primeiro passo","priority":"Alta","dueDate":null}]}';
  observed_plan jsonb;
  observed_status text;
  affected integer;
begin
  select id into owner_id from auth.users order by id limit 1;
  select id into other_id from auth.users where id <> owner_id order by id limit 1;
  if owner_id is null or other_id is null then
    raise exception 'Two existing auth users are required for this preview test';
  end if;
  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  execute 'set local role authenticated';
  insert into public.mika_ideas(user_id, content, source)
  values (owner_id, 'Teste de ciclo de vida - rollback', 'text')
  returning id into idea_id;
  update public.mika_ideas set proposed_plan = sample_plan, status = 'planned'
  where id = idea_id and user_id = owner_id;
  update public.mika_ideas set status = 'archived'
  where id = idea_id and user_id = owner_id;
  select proposed_plan into observed_plan from public.mika_ideas where id = idea_id;
  if observed_plan is distinct from sample_plan then
    raise exception 'Archiving removed the saved plan';
  end if;
  update public.mika_ideas
  set status = case when proposed_plan is not null then 'planned' else 'captured' end
  where id = idea_id and user_id = owner_id;
  select status, proposed_plan into observed_status, observed_plan
  from public.mika_ideas where id = idea_id;
  if observed_status <> 'planned' or observed_plan is distinct from sample_plan then
    raise exception 'Restoring did not preserve the saved plan';
  end if;
  -- Editing an archived idea must not silently restore it; the old plan is invalidated.
  update public.mika_ideas set status = 'archived' where id = idea_id and user_id = owner_id;
  update public.mika_ideas
  set content = 'Ideia editada em arquivo', proposed_plan = null, status = 'archived'
  where id = idea_id and user_id = owner_id;
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'Archived idea edit did not update one row'; end if;
  select status, proposed_plan into observed_status, observed_plan
  from public.mika_ideas where id = idea_id;
  if observed_status <> 'archived' or observed_plan is not null then
    raise exception 'Editing an archived idea restored it or retained an obsolete plan';
  end if;
  perform set_config('request.jwt.claim.sub', other_id::text, true);
  select count(*) into affected from public.mika_ideas where id = idea_id;
  if affected <> 0 then raise exception 'RLS read isolation failed'; end if;
  update public.mika_ideas set status = 'archived' where id = idea_id;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'RLS write isolation failed'; end if;
end $$;
rollback;
