-- MYRYRA Journey: atomic replan RPC, captured from the active database on 2026-11-10.
-- Review and apply in a controlled migration process. No user missions are changed by this DDL.
CREATE OR REPLACE FUNCTION public.myryra_apply_journey_replan_atomic(p_journey_id uuid, p_expected_updated_at text, p_mission_titles text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare v_owner uuid := (select auth.uid()); v_updated timestamptz; v_completed integer; v_removed integer; v_added integer; v_count integer;
begin
 if v_owner is null then raise exception 'Autenticação necessária' using errcode='42501'; end if;
 if p_expected_updated_at is null or p_expected_updated_at !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T' then raise exception 'Revisão inválida' using errcode='22023'; end if;
 if p_mission_titles is null or array_ndims(p_mission_titles) <> 1 or coalesce(array_length(p_mission_titles,1),0) not between 1 and 104 then raise exception 'Missões inválidas' using errcode='22023'; end if;
 if exists (select 1 from unnest(p_mission_titles) as t(title) where title is null or length(btrim(title)) not between 1 and 160) then raise exception 'Título inválido' using errcode='22023'; end if;
 if (select count(distinct translate(lower(btrim(title)), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')) from unnest(p_mission_titles) as t(title)) <> cardinality(p_mission_titles) then raise exception 'Missões duplicadas' using errcode='22023'; end if;
 select updated_at into v_updated from public.myryra_journeys where id=p_journey_id and owner_id=v_owner and status='active' for update;
 if not found then raise exception 'Jornada não encontrada' using errcode='42501'; end if;
 if v_updated <> p_expected_updated_at::timestamptz then raise exception 'Jornada modificada' using errcode='40001'; end if;
 select count(*) into v_completed from public.myryra_journey_missions where journey_id=p_journey_id and status='completed';
 if v_completed + cardinality(p_mission_titles) > 104 then raise exception 'Limite de missões excedido' using errcode='22023'; end if;
 if exists(select 1 from public.myryra_journey_missions m join unnest(p_mission_titles) t(title) on translate(lower(btrim(m.title)), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')=translate(lower(btrim(t.title)), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') where m.journey_id=p_journey_id and m.status='completed') then raise exception 'Missão concluída repetida' using errcode='22023'; end if;
 delete from public.myryra_journey_missions where journey_id=p_journey_id and status='pending';
 get diagnostics v_removed = row_count;
 insert into public.myryra_journey_missions(journey_id,title,status)
 select p_journey_id,btrim(title),'pending' from unnest(p_mission_titles) as t(title);
 get diagnostics v_added = row_count;
 update public.myryra_journeys set updated_at=clock_timestamp() where id=p_journey_id and owner_id=v_owner;
 return jsonb_build_object('completed_preserved',v_completed,'pending_removed',v_removed,'pending_created',v_added);
end;
$function$
;
REVOKE ALL ON FUNCTION public.myryra_apply_journey_replan_atomic(uuid,text,text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.myryra_apply_journey_replan_atomic(uuid,text,text[]) TO authenticated;
