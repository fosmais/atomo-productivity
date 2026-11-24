-- Candidate migration: classify new conversations; legacy content remains unclassified.
begin;
alter table public.myka_conversations add column processing_purpose text not null default 'legacy_unclassified' check (processing_purpose in ('legacy_unclassified','general','health_mika_sharing'));
create function public.myka_conversation_purpose_immutable() returns trigger language plpgsql set search_path='' as $$ begin if new.processing_purpose is distinct from old.processing_purpose then raise exception 'conversation purpose is immutable'; end if; return new; end $$;
create trigger myka_conversation_purpose_immutable before update on public.myka_conversations for each row execute function public.myka_conversation_purpose_immutable();
revoke all on function public.myka_conversation_purpose_immutable() from public,anon,authenticated;
commit;
