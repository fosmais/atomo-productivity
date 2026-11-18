-- Read-only parity gate for critical PROD indexes and calendar conflict trigger.
with required_indexes(indexname) as (values
 ('events_autopilot_task_once_per_user_idx'),
 ('events_pkey'),
 ('events_user_category_idx'),
 ('events_user_deleted_at_idx'),
 ('events_user_start_idx'),
 ('favorites_pkey'),
 ('favorites_user_created_idx'),
 ('favorites_user_event_unique'),
 ('favorites_user_task_unique'),
 ('google_calendar_connections_pkey'),
 ('myka_conversations_id_user_unique'),
 ('myka_conversations_pkey'),
 ('myka_conversations_user_updated_idx'),
 ('myka_messages_conversation_created_idx'),
 ('myka_messages_pkey'),
 ('plans_pkey'),
 ('tasks_pkey'),
 ('tasks_user_deleted_at_idx')
)
select r.indexname,
       case when i.indexname is null then 'MISSING' else 'OK' end as status
from required_indexes r
left join pg_indexes i on i.schemaname='public' and i.indexname=r.indexname
order by r.indexname;

select event_object_table,trigger_name,event_manipulation,action_timing
from information_schema.triggers
where trigger_schema='public'
  and trigger_name='myryra_guard_blocking_event_overlap'
order by event_manipulation;

select case when to_regprocedure('public.myryra_guard_blocking_event_overlap()') is null
            then 'MISSING_FUNCTION' else 'FUNCTION_PRESENT' end as trigger_function_status;
