-- STAGING ONLY. Rollback-only negative-path regression for MIKA SECURITY DEFINER RPCs.
-- Simulates authenticated JWT claims at SQL level; NOT an actual Supabase Auth HTTP session.
-- Requires exactly two confirmed staging users and no existing MIKA plans/proposals.
-- Never run against production. No persisted fixtures or changes.
BEGIN;
DO $test$
DECLARE
  users uuid[];
  owner_id uuid;
  foreign_id uuid;
  plan_id uuid;
  proposal_id uuid;
  denied integer := 0;
  proposal_status text;
BEGIN
  SELECT array_agg(id ORDER BY id) INTO users
  FROM auth.users WHERE email_confirmed_at IS NOT NULL;
  IF coalesce(array_length(users, 1), 0) <> 2 THEN
    RAISE EXCEPTION 'Expected exactly two confirmed staging users';
  END IF;
  IF EXISTS (SELECT 1 FROM public.plans)
     OR EXISTS (SELECT 1 FROM public.mika_action_proposals) THEN
    RAISE EXCEPTION 'Unexpected existing plans or proposals; abort';
  END IF;
  owner_id := users[1];
  foreign_id := users[2];
  INSERT INTO public.plans(user_id,title)
  VALUES(owner_id,'[MIKA-STAGING-TEST] cross-user rollback plan')
  RETURNING id INTO plan_id;
  INSERT INTO public.mika_action_proposals(user_id,action_type,payload,status,expires_at)
  VALUES (
    owner_id,'create_task',
    jsonb_build_object(
      'type','create_task','plan_id',plan_id::text,
      'title','[MIKA-STAGING-TEST] cross-user rollback task',
      'reason','Staging authorization regression','due_at',null
    ),'pending',now()+interval '30 minutes'
  ) RETURNING id INTO proposal_id;
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.sub',foreign_id::text,true);
  PERFORM set_config('request.jwt.claim.role','authenticated',true);
  BEGIN
    PERFORM public.mika_decide_proposal(proposal_id,true);
    RAISE EXCEPTION 'SECURITY FAILURE: foreign approval succeeded';
  EXCEPTION WHEN SQLSTATE 'P0002' THEN denied := denied + 1;
  END;
  BEGIN
    PERFORM public.mika_execute_approved_task(proposal_id,plan_id);
    RAISE EXCEPTION 'SECURITY FAILURE: foreign execution succeeded';
  EXCEPTION WHEN SQLSTATE 'P0002' THEN denied := denied + 1;
  END;
  IF denied <> 2 THEN
    RAISE EXCEPTION 'Expected two foreign-user denials, got %',denied;
  END IF;
  RESET ROLE;
  SELECT status INTO proposal_status FROM public.mika_action_proposals WHERE id=proposal_id;
  IF proposal_status <> 'pending' THEN
    RAISE EXCEPTION 'Proposal was mutated: %',proposal_status;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.tasks
    WHERE user_id=owner_id AND title='[MIKA-STAGING-TEST] cross-user rollback task'
  ) THEN
    RAISE EXCEPTION 'Unauthorized task was created';
  END IF;
END
$test$;
ROLLBACK;
