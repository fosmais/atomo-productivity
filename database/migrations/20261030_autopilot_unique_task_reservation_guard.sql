-- Prevent duplicate AutoPilot reservations even if two requests race.
-- Does not prohibit manually created overlapping events.
CREATE UNIQUE INDEX IF NOT EXISTS events_autopilot_task_once_per_user_idx
  ON public.events (user_id, notes)
  WHERE notes LIKE 'Tarefa MYRYRA: %';
