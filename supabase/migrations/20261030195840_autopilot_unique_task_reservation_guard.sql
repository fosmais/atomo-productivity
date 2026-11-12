-- Defense in depth: only one AutoPilot reservation per user/task.
-- Other events and manually scheduled overlaps are unaffected.
create unique index if not exists events_autopilot_task_once_per_user_idx
  on public.events (user_id, notes)
  where notes like 'Tarefa MYRYRA: %';