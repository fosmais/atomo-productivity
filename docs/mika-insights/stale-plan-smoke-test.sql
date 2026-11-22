-- MIKA Insights: stale plan protection regression. PREVIEW ONLY.
-- Simulates another session editing the idea before the user saves the AI plan.
-- All test writes are rolled back.
begin;
do $$
declare owner_id uuid; idea_id uuid; old_version timestamptz; affected integer; stored_plan jsonb;
begin
  select id into owner_id from auth.users order by id limit 1;
  if owner_id is null then raise exception 'No test user'; end if;
  insert into public.mika_ideas(user_id,content,source,status)
  values(owner_id,'Initial idea for concurrency test','text','captured')
  returning id,updated_at into idea_id,old_version;

  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  execute 'set local role authenticated';
  update public.mika_ideas
  set content='Edited in another session', updated_at=old_version+interval '1 second'
  where id=idea_id;

  with changed as (
    update public.mika_ideas
    set proposed_plan='{"tasks":[{"title":"Stale task","priority":"Normal","dueDate":null}]}'::jsonb,
        status='planned'
    where id=idea_id and user_id=owner_id and updated_at=old_version and status<>'archived'
    returning id
  ) select count(*) into affected from changed;
  if affected<>0 then raise exception 'Stale plan was saved'; end if;

  select proposed_plan into stored_plan from public.mika_ideas where id=idea_id;
  if stored_plan is not null then raise exception 'Stale plan persisted'; end if;
end $$;
rollback;
