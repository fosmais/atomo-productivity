-- MYRYRA MVP2 / MIKA Agente — fixture de proposta para homologação.
-- Executar SOMENTE no projeto Supabase xanavauqzsrgvdfhcrsm.
-- Substituir os UUIDs abaixo por IDs sintéticos confirmados pelo Supabase Auth.
-- NÃO executar em produção. NÃO usar usuários ou planos reais.
-- O script cria uma proposta PENDING. Aprovar somente via RPC autenticada.
-- Payload alinhado à constraint mika_action_proposals_check no staging.
BEGIN;
DO $fixture$
DECLARE
  v_project text := current_setting('app.settings.project_ref', true);
  v_owner uuid := '00000000-0000-0000-0000-000000000000'::uuid; -- SUBSTITUIR
  v_plan uuid := '00000000-0000-0000-0000-000000000000'::uuid; -- SUBSTITUIR
  v_email text;
  v_plan_title text;
  v_proposal_id uuid;
BEGIN
  -- O ref não é garantido como GUC em todas as instalações; conferir manualmente
  -- a conexão/projeto antes de executar. A identidade do projeto deve ser verificada
  -- fora do SQL; não confiar em current_setting como barreira de segurança.
  IF v_owner = '00000000-0000-0000-0000-000000000000'::uuid
     OR v_plan = '00000000-0000-0000-0000-000000000000'::uuid THEN
    RAISE EXCEPTION 'Substitua os UUIDs sintéticos de usuário e plano antes de executar';
  END IF;
  SELECT email INTO v_email FROM auth.users WHERE id = v_owner;
  IF v_email IS NULL OR v_email !~* '^mika-staging-test[+._a-z0-9-]*@' THEN
    RAISE EXCEPTION 'Usuário deve existir no Auth e usar email sintético mika-staging-test...';
  END IF;
  SELECT title INTO v_plan_title FROM public.plans WHERE id = v_plan AND user_id = v_owner;
  IF v_plan_title IS NULL OR v_plan_title NOT LIKE '[MIKA-STAGING-TEST]%' THEN
    RAISE EXCEPTION 'Plano sintético inexistente ou não pertence ao usuário';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.mika_action_proposals
    WHERE user_id = v_owner AND payload->>'plan_id' = v_plan::text
      AND status IN ('pending','approved')
      AND expires_at > now()
      AND payload->>'title' = '[MIKA-STAGING-TEST] Execução concorrente'
  ) THEN
    RAISE EXCEPTION 'Já existe proposta ativa equivalente; reutilize-a ou aguarde expirar';
  END IF;
  INSERT INTO public.mika_action_proposals(user_id,action_type,payload,status,expires_at)
  VALUES (v_owner,'create_task',jsonb_build_object(
    'type','create_task',
    'plan_id',v_plan::text,
    'title','[MIKA-STAGING-TEST] Execução concorrente',
    'reason','Teste controlado de concorrência em homologação',
    'due_at',null
  ),'pending',now()+interval '30 minutes')
  RETURNING id INTO v_proposal_id;
  RAISE NOTICE 'MIKA_STAGING_PROPOSAL_ID=%',v_proposal_id;
END
$fixture$;
COMMIT;
-- Depois: autenticar o usuário proprietário e chamar
-- mika_decide_proposal(p_proposal_id := <ID>, p_approve := true).
-- Rodar scripts/mika-cross-user-staging.cjs ANTES de
-- scripts/mika-concurrency-staging.cjs.
