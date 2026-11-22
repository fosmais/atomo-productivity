-- Disposable PostgreSQL only; verify effective role grants and policy boundaries.
do $assert$
begin
  if has_table_privilege('anon','public.myryra_journeys','SELECT')
     or has_table_privilege('anon','public.mika_teacher_sessions','SELECT')
     or has_table_privilege('anon','public.mika_teacher_messages','SELECT') then
    raise exception 'Anonymous role has unexpected SELECT privileges';
  end if;
  if not has_table_privilege('authenticated','public.myryra_journeys','SELECT')
     or not has_table_privilege('authenticated','public.mika_teacher_sessions','SELECT')
     or not has_table_privilege('authenticated','public.mika_teacher_messages','SELECT') then
    raise exception 'Authenticated role lacks expected SELECT privileges';
  end if;
  if has_table_privilege('authenticated','public.mika_teacher_messages','INSERT')
     or has_table_privilege('authenticated','public.mika_teacher_messages','UPDATE')
     or has_table_privilege('authenticated','public.mika_teacher_messages','DELETE') then
    raise exception 'Client can modify Teacher messages directly';
  end if;
  if has_column_privilege('authenticated','public.mika_teacher_sessions','owner_id','UPDATE')
     or has_column_privilege('authenticated','public.mika_teacher_sessions','journey_id','UPDATE')
     or has_column_privilege('authenticated','public.mika_teacher_sessions','status','UPDATE') then
    raise exception 'Client can update protected Teacher session fields';
  end if;
  if not has_column_privilege('authenticated','public.mika_teacher_sessions','scheduled_at','UPDATE') then
    raise exception 'Client cannot reschedule own Teacher session';
  end if;
end $assert$;
