import type { SupabaseClient } from "@supabase/supabase-js";

import {
  calculateAvailability,
  type TimeInterval,
} from "@/lib/availability-engine";

import { generatePlanningWindows } from "@/lib/planning-windows";

import type { PlanningPreferences } from "@/lib/planning-preferences";

export type ServerDailyAvailability = {
  window: TimeInterval;
  available: TimeInterval[];
  blocked: TimeInterval[];
};

export type ServerAvailabilityResult = {
  preferences: PlanningPreferences;
  days: ServerDailyAvailability[];
};

export async function getServerAvailability(
  supabase: SupabaseClient,
  userId: string,
  from = new Date(),
  numberOfDays = 7
): Promise<ServerAvailabilityResult> {
  if (
    !userId ||
    !Number.isFinite(from.getTime()) ||
    !Number.isInteger(numberOfDays) ||
    numberOfDays < 1 ||
    numberOfDays > 31
  ) {
    throw new Error("Parâmetros de disponibilidade inválidos.");
  }

  // Nunca confiar somente no userId recebido.
  // Confirmar a identidade na sessão autenticada.
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user || user.id !== userId) {
    throw new Error("Usuário não autenticado.");
  }

  const { data: savedPreferences, error: preferencesError } =
    await supabase
      .from("planning_preferences")
      .select("start_time, end_time, weekdays, time_zone")
      .eq("user_id", userId)
      .maybeSingle();

  if (preferencesError) {
    throw new Error(preferencesError.message);
  }

  const preferences: PlanningPreferences = savedPreferences
    ? {
        startTime: savedPreferences.start_time.slice(0, 5),
        endTime: savedPreferences.end_time.slice(0, 5),
        weekdays: savedPreferences.weekdays,
        timeZone: savedPreferences.time_zone,
      }
    : {
        startTime: "09:00",
        endTime: "18:00",
        weekdays: [1, 2, 3, 4, 5],
        timeZone: "America/Sao_Paulo",
      };

  const windows = generatePlanningWindows(
    preferences,
    from,
    numberOfDays
  );

  if (windows.length === 0) {
    return { preferences, days: [] };
  }

  const rangeStart = windows[0].start;
  const rangeEnd = windows[windows.length - 1].end;

  const { data: events, error: eventsError } = await supabase
    .from("events")
    .select("starts_at, ends_at")
    .eq("user_id", userId)
    .eq("blocks_time", true)
    .lt("starts_at", rangeEnd.toISOString())
    .gt("ends_at", rangeStart.toISOString());

  if (eventsError) {
    throw new Error(eventsError.message);
  }

  const blockedIntervals: TimeInterval[] = (events ?? []).map(
    (event) => ({
      start: new Date(event.starts_at),
      end: new Date(event.ends_at),
    })
  );

  const days = windows.map((window) => {
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

  return {
    preferences,
    days,
  };
}
