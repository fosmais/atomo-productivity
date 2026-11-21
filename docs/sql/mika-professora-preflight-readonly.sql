-- MYRYRA MIKA Professora: preflight SOMENTE LEITURA
-- Retorna prontidao de dependencias, sem dados de usuarios e sem alterar producao.
select
  to_regclass('public.myryra_journeys') is not null as journeys_exists,
  to_regclass('public.mika_teacher_sessions') is not null as teacher_sessions_exists,
  to_regclass('public.mika_teacher_messages') is not null as teacher_messages_exists,
  exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='myryra_journeys'
      and column_name='owner_id'
  ) as journey_owner_column_exists,
  exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='myryra_journeys'
      and column_name='status'
  ) as journey_status_column_exists;
-- A presenca de tabelas nao substitui testes RLS, MFA, API e persistencia.
