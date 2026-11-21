-- MIKA Agent: cross-user proposal authorization regression.
-- Run in homologation only. All synthetic users/proposals are rolled back.
BEGIN;
DO $test$
DECLARE
 owner_a uuid := gen_random_uuid();
 owner_b uuid := gen_random_uuid();
 proposal uuid := gen_random_uuid();
 denied_approve boolean := false;
 denied_execute boolean := false;
BEGIN
 INSERT INTO auth.users(id,instance_id,aud,role,email)
 VALUES
 (owner_a,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','mika-a-'||owner_a||'@example.invalid'),
 (owner_b,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','mika-b-'||owner_b||'@example.invalid');

 INSERT INTO public.mika_action_proposals(id,user_id,action_type,payload,status)
 VALUES(proposal,owner_a,'create_task',
   jsonb_build_object('type','create_task','title','Teste acesso cruzado',
                      'reason','Validacao de seguranca','due_at',null),'pending');

 PERFORM set_config('request.jwt.claim.sub',owner_b::text,true);
 SET LOCAL ROLE authenticated;
 BEGIN
  PERFORM * FROM public.mika_decide_proposal(proposal,true);
 EXCEPTION WHEN SQLSTATE 'P0002' THEN denied_approve := true;
 END;
 BEGIN
  PERFORM * FROM public.mika_execute_approved_task(proposal,gen_random_uuid());
 EXCEPTION WHEN SQLSTATE 'P0002' THEN denied_execute := true;
 END;
 RESET ROLE;

 IF NOT denied_approve OR NOT denied_execute
 THEN RAISE EXCEPTION 'Cross-user RPC access not denied'; END IF;
 IF (SELECT status FROM public.mika_action_proposals WHERE id=proposal) <> 'pending'
 THEN RAISE EXCEPTION 'Cross-user attempt changed proposal'; END IF;
 IF EXISTS (SELECT 1 FROM public.mika_action_audit WHERE proposal_id=proposal)
 THEN RAISE EXCEPTION 'Cross-user attempt wrote audit'; END IF;
END $test$;
ROLLBACK;
