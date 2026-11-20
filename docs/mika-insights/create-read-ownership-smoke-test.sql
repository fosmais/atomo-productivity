-- MIKA Insights creation/read RLS regression. PREVIEW ONLY.
-- Uses two existing auth users; all changes are rolled back.
begin;
do $$
declare owner_id uuid; other_id uuid; idea_id uuid; found integer;
begin
  select id into owner_id from auth.users order by id limit 1;
  select id into other_id from auth.users where id<>owner_id order by id limit 1;
  if owner_id is null or other_id is null then raise exception 'Two users required'; end if;
  perform set_config('request.jwt.claim.sub',other_id::text,true);
  execute 'set local role authenticated';
  begin
    insert into public.mika_ideas(user_id,content,source,status)
    values(owner_id,'Forged idea','text','captured');
    raise exception 'Cross-user insert unexpectedly succeeded';
  exception when insufficient_privilege or check_violation then null;
  end;
  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  insert into public.mika_ideas(user_id,content,source,status)
  values(owner_id,'Authorized idea','text','captured') returning id into idea_id;
  select count(*) into found from public.mika_ideas where id=idea_id;
  if found<>1 then raise exception 'Owner cannot read created idea'; end if;
  perform set_config('request.jwt.claim.sub',other_id::text,true);
  select count(*) into found from public.mika_ideas where id=idea_id;
  if found<>0 then raise exception 'Cross-user read succeeded'; end if;
end $$;
rollback;
