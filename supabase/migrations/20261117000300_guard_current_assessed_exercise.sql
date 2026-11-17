-- Require completion evidence to match latest server-issued exercise.
-- Enforce assessment at the database write boundary, closing the API check/update race.
create or replace function public.myryra_guard_assessed_mission_completion()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  mission_owner uuid;
  needs_assessment boolean;
  required_score integer;
  evidence record;
  current_exercise uuid;
begin
  if new.status is distinct from 'completed' or
     (tg_op = 'UPDATE' and old.status = 'completed') then
    return new;
  end if;
  select j.owner_id into mission_owner from public.myryra_journeys j where j.id = new.journey_id;
  if mission_owner is null then
    raise exception 'Jornada sem proprietario valido.' using errcode = '23514';
  end if;
  select (coalesce(p.requires_assessment, false) or
          exists (select 1 from public.mika_teacher_sessions s
                  where s.mission_id = new.id and s.journey_id = new.journey_id and s.owner_id = mission_owner) or
          exists (select 1 from public.myryra_journey_assigned_exercises ae
                  where ae.mission_id = new.id and ae.owner_id = mission_owner) or
          new.title ~* 'IA, machine learning e IA generativa|diferença entre IA, ML e modelos generativos|treino, validação, teste|vazamento|vieses|classificação, regressão|métricas de avaliação|métricas adequadas|prompts estruturados|respostas de IA|embeddings|RAG|busca semântica|fontes verificáveis|LGPD|uso responsável|privacidade, segurança|riscos e controles|pequeno projeto aplicado|problema, dados, indicadores|protótipo viável|apresentar o projeto|demonstração curta'),
         coalesce(p.minimum_score, 70)
    into needs_assessment, required_score
    from (select 1) x
    left join public.myryra_journey_mission_assessment_policy p
      on p.mission_id = new.id and p.owner_id = mission_owner;
  if needs_assessment then
    select answer, feedback, assessment_passed, assessment_score, assessed_exercise_id
      into evidence from public.myryra_journey_learning_progress
      where mission_id = new.id and owner_id = mission_owner
      for update;
    if not found or nullif(btrim(evidence.answer), '') is null
       or nullif(btrim(evidence.feedback), '') is null
       or evidence.assessment_passed is distinct from true
       or evidence.assessment_score is null
       or evidence.assessment_score < required_score then
      raise exception 'Missao educacional exige avaliacao aprovada e persistida.'
        using errcode = '23514';
    end if;
    -- For assigned exercises, a grade is valid only for the latest
    -- server-issued version. Legacy missions without an assignment retain
    -- the existing assessment policy until issuance is mandatory.
    select ae.id into current_exercise
      from public.myryra_journey_assigned_exercises ae
      where ae.mission_id = new.id and ae.owner_id = mission_owner
      order by ae.version desc limit 1;
    if current_exercise is not null and
       evidence.assessed_exercise_id is distinct from current_exercise then
      raise exception 'Avaliacao vinculada a exercicio desatualizado.'
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$;
revoke all on function public.myryra_guard_assessed_mission_completion() from public, anon, authenticated;
drop trigger if exists myryra_assessed_mission_completion_guard on public.myryra_journey_missions;
create trigger myryra_assessed_mission_completion_guard
  before insert or update of status on public.myryra_journey_missions
  for each row execute function public.myryra_guard_assessed_mission_completion();
