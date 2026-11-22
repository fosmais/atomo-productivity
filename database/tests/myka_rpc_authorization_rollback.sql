-- Read-only authorization regression; transaction is rolled back.
-- Execute in the MYRYRA Supabase SQL editor, never against unrelated projects.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
do $$
declare v_id uuid := '22222222-2222-4222-8222-222222222222';
begin
  begin
    perform public.myka_cancel_task_item(v_id,0);
    raise exception 'SECURITY TEST FAILED: cancellation unexpectedly succeeded';
  exception when others then
    if sqlerrm <> 'Mensagem nao encontrada' then raise; end if;
  end;
  begin
    perform public.myka_confirm_task_item(v_id,0);
    raise exception 'SECURITY TEST FAILED: confirmation unexpectedly succeeded';
  exception when others then
    if sqlerrm <> 'Mensagem nao encontrada' then raise; end if;
  end;
end $$;
rollback;
