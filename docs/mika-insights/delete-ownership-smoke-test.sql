-- MIKA Insights: owner-only deletion smoke test. PREVIEW ONLY.
-- Uses two existing auth users and rolls back all test changes.
begin;
do $$
declare owner_id uuid; other_id uuid; idea_id uuid; deleted_count integer;
begin
  select id into owner_id from auth.users order by id limit 1;
  select id into other_id from auth.users where id<>owner_id order by id limit 1;
  if owner_id is null or other_id is null then
    raise exception 'Two existing users are required';
  end if;
  insert into public.mika_ideas(user_id,content,source,status)
  values(owner_id,'MIKA Insights deletion security test - rollback','text','captured')
  returning id into idea_id;

  perform set_config('request.jwt.claim.sub',other_id::text,true);
  execute 'set local role authenticated';
  with deleted as (delete from public.mika_ideas where id=idea_id returning id)
  select count(*) into deleted_count from deleted;
  if deleted_count<>0 then raise exception 'Cross-user deletion succeeded'; end if;

  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  with deleted as (delete from public.mika_ideas where id=idea_id returning id)
  select count(*) into deleted_count from deleted;
  if deleted_count<>1 then raise exception 'Owner deletion did not return one record'; end if;
end $$;
rollback;
