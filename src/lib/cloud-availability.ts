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
    .eq("blocks_time", true)
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
