import { createClient } from "@/lib/supabase/client";

export type PlanningPreferences = {
  startTime: string;
  endTime: string;
  weekdays: number[];
  timeZone: string;
};

export const DEFAULT_PLANNING_PREFERENCES: PlanningPreferences = {
  startTime: "09:00",
  endTime: "18:00",
  weekdays: [1, 2, 3, 4, 5],
  timeZone: "America/Sao_Paulo",
};

async function authenticatedClient() {
  const supabase = createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("Usuário não autenticado.");
  }

  return { supabase, userId: user.id };
}

export async function getPlanningPreferences():
  Promise<PlanningPreferences> {
  const { supabase, userId } = await authenticatedClient();

  const { data, error } = await supabase
    .from("planning_preferences")
    .select("start_time, end_time, weekdays, time_zone")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return {
      ...DEFAULT_PLANNING_PREFERENCES,
      weekdays: [...DEFAULT_PLANNING_PREFERENCES.weekdays],
    };
  }

  return {
    startTime: data.start_time.slice(0, 5),
    endTime: data.end_time.slice(0, 5),
    weekdays: data.weekdays,
    timeZone: data.time_zone,
  };
}

export async function savePlanningPreferences(
  preferences: PlanningPreferences
): Promise<void> {
  const { supabase, userId } = await authenticatedClient();

  const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

  if (
    !timePattern.test(preferences.startTime) ||
    !timePattern.test(preferences.endTime) ||
    preferences.startTime >= preferences.endTime
  ) {
    throw new Error("Informe um intervalo de horário válido.");
  }

  if (
    preferences.weekdays.length === 0 ||
    preferences.weekdays.length > 7 ||
    new Set(preferences.weekdays).size !== preferences.weekdays.length ||
    !preferences.weekdays.every(
      (day) => Number.isInteger(day) && day >= 0 && day <= 6
    )
  ) {
    throw new Error("Selecione dias da semana válidos.");
  }

  try {
    new Intl.DateTimeFormat("pt-BR", {
      timeZone: preferences.timeZone,
    }).format(new Date());
  } catch {
    throw new Error("Fuso horário inválido.");
  }

  const { error } = await supabase
    .from("planning_preferences")
    .upsert(
      {
        user_id: userId,
        start_time: preferences.startTime,
        end_time: preferences.endTime,
        weekdays: preferences.weekdays,
        time_zone: preferences.timeZone,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

  if (error) {
    throw new Error(error.message);
  }
}
