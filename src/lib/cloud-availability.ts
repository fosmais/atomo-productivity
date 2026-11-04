import { createClient } from "@/lib/supabase/client";

import {
  getPlanningPreferences,
} from "@/lib/planning-preferences";

import {
  generatePlanningWindows,
} from "@/lib/planning-windows";

import {
  calculateAvailability,
  type TimeInterval,
} from "@/lib/availability-engine";

export type DailyAvailability = {
  window: TimeInterval;
  available: TimeInterval[];
  blocked: TimeInterval[];
};

export async function getCloudAvailability(
  from = new Date(),
  numberOfDays = 7
): Promise<DailyAvailability[]> {
  if (
    !Number.isFinite(from.getTime()) ||
    !Number.isInteger(numberOfDays) ||
    numberOfDays < 1 ||
    numberOfDays > 31
  ) {
    throw new Error("Período de consulta inválido.");
  }

  const supabase = createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Usuário não autenticado.");
  }

  const preferences = await getPlanningPreferences();

  const windows = generatePlanningWindows(
    preferences,
    from,
    numberOfDays
  );

  if (windows.length === 0) {
    return [];
  }

  const rangeStart = windows[0].start;
  const rangeEnd = windows[windows.length - 1].end;

  const { data: events, error } = await supabase
    .from("events")
    .select("starts_at, ends_at")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    // Every saved appointment occupies its time slot, including legacy events
    // that were created with blocks_time=false.
    .lt("starts_at", rangeEnd.toISOString())
    .gt("ends_at", rangeStart.toISOString());

  if (error) {
    throw new Error(error.message);
  }

  const blockedIntervals: TimeInterval[] = (
    events ?? []
  ).map((event) => ({
    start: new Date(event.starts_at),
    end: new Date(event.ends_at),
  }));

  // Timed, unfinished tasks also reserve time on the MYRYRA calendar.
  // A due date without a start/duration is only a deadline, not a busy slot.
  const { data: timedTasks, error: tasksError } = await supabase
    .from("tasks")
    .select("due_date, duration_minutes, completed")
    .eq("user_id", user.id)
    .eq("completed", false)
    .not("due_date", "is", null)
    .gte("due_date", rangeStart.toISOString())
    .lt("due_date", rangeEnd.toISOString());
  if (tasksError) throw new Error(tasksError.message);

  for (const task of timedTasks ?? []) {
    const duration = task.duration_minutes;
    if (!Number.isInteger(duration) || duration <= 0 || duration > 1440) continue;
    const end = new Date(task.due_date);
    if (!Number.isFinite(end.getTime())) continue;
    const start = new Date(end.getTime() - duration * 60_000);
    if (start < end) blockedIntervals.push({ start, end });
  }

  return windows.map((window) => {
    const result = calculateAvailability(
      window,
      blockedIntervals
    );

    return {
      window,
      available: result.available,
      blocked: result.blocked,
    };
  });
}
