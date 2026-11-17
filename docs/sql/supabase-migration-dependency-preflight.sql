-- MYRYRA migration dependency preflight, READ ONLY.
-- Intended for a fresh disposable database BEFORE replaying incremental migrations.
-- Does not create, alter or read user data.
--
-- First historical migration: 20261030174834 autopilot_transactional_reservation
-- Next historical migration: 20261030195840 autopilot_unique_task_reservation_guard
-- These depend on tables and columns that must exist before the latter is run.

with required(table_name, column_name) as (
  values
    ('tasks', 'id'), ('tasks', 'user_id'), ('tasks', 'title'),
    ('tasks', 'completed'), ('tasks', 'duration_minutes'),
    ('events', 'id'), ('events', 'user_id'), ('events', 'title'),
    ('events', 'starts_at'), ('events', 'ends_at'),
    ('events', 'notes'), ('events', 'event_type'), ('events', 'blocks_time')
)
select r.table_name, r.column_name,
       (c.column_name is not null) as present
from required r
left join information_schema.columns c
  on c.table_schema = 'public'
 and c.table_name = r.table_name
 and c.column_name = r.column_name
order by r.table_name, r.column_name;

-- For a human-readable missing-dependency list:
with required(table_name, column_name) as (
  values
    ('tasks', 'id'), ('tasks', 'user_id'), ('tasks', 'title'),
    ('tasks', 'completed'), ('tasks', 'duration_minutes'),
    ('events', 'id'), ('events', 'user_id'), ('events', 'title'),
    ('events', 'starts_at'), ('events', 'ends_at'),
    ('events', 'notes'), ('events', 'event_type'), ('events', 'blocks_time')
)
select r.table_name, r.column_name
from required r
left join information_schema.columns c
  on c.table_schema = 'public'
 and c.table_name = r.table_name
 and c.column_name = r.column_name
where c.column_name is null
order by r.table_name, r.column_name;
