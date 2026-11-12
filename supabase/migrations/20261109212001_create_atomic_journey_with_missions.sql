create or replace function public.myryra_create_journey_with_missions(p_title text,p_description text,p_target_date date,p_missions text[]) returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_owner uuid := (select auth.uid()); v_id uuid; v_title text;
begin
 if v_owner is null then raise exception 'Authentication required' using errcode='28000'; end if;
 if p_title is null or length(btrim(p_title)) not between 1 and 120 then raise exception 'Invalid title' using errcode='22023'; end if;
 if p_description is not null and length(p_description)>2000 then raise exception 'Invalid description' using errcode='22023'; end if;
 if p_missions is null or cardinality(p_missions) not between 1 and 30 then raise exception 'Invalid missions' using errcode='22023'; end if;
 foreach v_title in array p_missions loop
   if v_title is null or length(btrim(v_title)) not between 1 and 160 then raise exception 'Invalid mission title' using errcode='22023'; end if;
 end loop;
 insert into public.myryra_journeys(owner_id,title,description,target_date,status,visibility) values(v_owner,btrim(p_title),nullif(btrim(p_description),''),p_target_date,'active','private') returning id into v_id;
 insert into public.myryra_journey_missions(journey_id,title,status)
 select v_id,btrim(t),'pending' from unnest(p_missions) as t;
 return v_id;
end $$;
revoke all on function public.myryra_create_journey_with_missions(text,text,date,text[]) from public,anon;
grant execute on function public.myryra_create_journey_with_missions(text,text,date,text[]) to authenticated;