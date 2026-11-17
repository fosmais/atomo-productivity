-- Read-only structural gate for seven core MYRYRA tables.
-- Run on PROD and each preview; no user rows, credentials, or mutations.
with required(table_name,column_name,pg_type,is_required) as (
 values
 ('plans','id','uuid',true),('plans','user_id','uuid',true),('plans','title','text',true),
 ('tasks','id','uuid',true),('tasks','plan_id','uuid',true),('tasks','user_id','uuid',true),
 ('tasks','title','text',true),('tasks','completed','boolean',true),('tasks','duration_minutes','integer',false),
 ('events','id','uuid',true),('events','user_id','uuid',true),('events','title','text',true),
 ('events','starts_at','timestamp with time zone',true),('events','ends_at','timestamp with time zone',true),
 ('favorites','id','uuid',true),('favorites','user_id','uuid',true),('favorites','task_id','uuid',false),
 ('favorites','event_id','uuid',false),
 ('myka_conversations','id','uuid',true),('myka_conversations','user_id','uuid',true),
 ('myka_conversations','title','text',true),
 ('myka_messages','id','uuid',true),('myka_messages','conversation_id','uuid',true),
 ('myka_messages','user_id','uuid',true),('myka_messages','content','text',true),
 ('google_calendar_connections','user_id','uuid',true),
 ('google_calendar_connections','encrypted_access_token','text',true)
)
select r.table_name,r.column_name,
 case when a.attname is null then 'MISSING'
      when format_type(a.atttypid,a.atttypmod) <> r.pg_type then 'TYPE_MISMATCH'
      when a.attnotnull <> r.is_required then 'NULLABILITY_MISMATCH'
      else 'OK' end as status,
 format_type(a.atttypid,a.atttypmod) as actual_type
from required r
left join pg_namespace n on n.nspname='public'
left join pg_class c on c.relnamespace=n.oid and c.relname=r.table_name and c.relkind in ('r','p')
left join pg_attribute a on a.attrelid=c.oid and a.attname=r.column_name and a.attnum>0 and not a.attisdropped
order by r.table_name,r.column_name;
