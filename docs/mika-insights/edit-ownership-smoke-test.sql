-- MIKA Insights owner-only editing and persistence smoke test. PREVIEW ONLY.
-- Requires two existing auth.users. All writes are rolled back.
begin;
do $$
declare owner_id uuid; other_id uuid; idea_id uuid; affected integer; stored_content text;
begin
  select id into owner_id from auth.users order by id limit 1;
  select id into other_id from auth.users where id<>owner_id order by id limit 1;
  if owner_id is null or other_id is null then raise exception 'Two users required'; end if;
  insert into public.mika_ideas(user_id,content,source,status)
  values(owner_id,'Original MIKA edit test','text','captured') returning id into idea_id;

  perform set_config('request.jwt.claim.sub',other_id::text,true);
  execute 'set local role authenticated';
  with changed as (update public.mika_ideas set content='Unauthorized edit'
    where id=idea_id returning id)
  select count(*) into affected from changed;
  if affected<>0 then raise exception 'Cross-user edit succeeded'; end if;

  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  with changed as (update public.mika_ideas set content='Authorized edit'
    where id=idea_id returning id)
  select count(*) into affected from changed;
  if affected<>1 then raise exception 'Owner edit failed'; end if;

  select content into stored_content from public.mika_ideas where id=idea_id;
  if stored_content<>'Authorized edit' then raise exception 'Edit not persisted'; end if;
end $$;
rollback;
