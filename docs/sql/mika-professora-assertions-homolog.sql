-- MIKA Professora: testes de privilégios após aplicação em HOMOLOGAÇÃO.
-- Apenas leitura; falha explicitamente se algum requisito não for atendido.
-- NÃO substitui testes autenticados com dois usuários distintos.
do $$
begin
  if to_regclass('public.mika_teacher_sessions') is null
     or to_regclass('public.mika_teacher_messages') is null then
    raise exception 'MIKA: tabelas de sessoes/mensagens ausentes';
  end if;
  if not (select relrowsecurity from pg_class
          where oid='public.mika_teacher_sessions'::regclass)
     or not (select relrowsecurity from pg_class
             where oid='public.mika_teacher_messages'::regclass) then
    raise exception 'MIKA: RLS desabilitado';
  end if;
  if has_table_privilege('anon','public.mika_teacher_sessions','SELECT')
     or has_table_privilege('anon','public.mika_teacher_messages','SELECT') then
    raise exception 'MIKA: anon pode ler tabelas privadas';
  end if;
  if has_table_privilege('authenticated','public.mika_teacher_messages','INSERT')
     or has_table_privilege('authenticated','public.mika_teacher_messages','UPDATE')
     or has_table_privilege('authenticated','public.mika_teacher_messages','DELETE') then
    raise exception 'MIKA: cliente autenticado pode modificar transcricoes';
  end if;
  if not has_table_privilege('authenticated','public.mika_teacher_messages','SELECT')
     or not has_table_privilege('authenticated','public.mika_teacher_sessions','SELECT')
     or not has_table_privilege('authenticated','public.mika_teacher_sessions','INSERT')
     or not has_table_privilege('authenticated','public.mika_teacher_sessions','DELETE') then
    raise exception 'MIKA: privilegios de acesso esperados ausentes';
  end if;
  if (select count(*) from pg_policies
      where schemaname='public' and tablename='mika_teacher_sessions'
      and policyname in ('teacher sessions select own','teacher sessions insert own journey','teacher sessions delete own')) <> 3
     or (select count(*) from pg_policies
         where schemaname='public' and tablename='mika_teacher_messages'
         and policyname='teacher messages select own') <> 1 then
    raise exception 'MIKA: politicas RLS esperadas ausentes';
  end if;
end $$;
-- Retorno sem excecao = preflight estrutural aprovado; E2E continua obrigatorio.
