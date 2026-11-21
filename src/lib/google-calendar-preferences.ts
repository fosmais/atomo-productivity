import { createClient } from "@/lib/supabase/client";

export type GoogleCalendarPreferences = {
  selectedCalendarIds: string[] | null;
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

export async function getGoogleCalendarPreferences():
  Promise<GoogleCalendarPreferences> {
  const { supabase, userId } = await authenticatedClient();

  const { data, error } = await supabase
    .from("google_calendar_preferences")
    .select("selected_calendar_ids")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(
      "Não foi possível carregar as preferências dos calendários."
    );
  }

  return {
    selectedCalendarIds: data
      ? data.selected_calendar_ids
      : null,
  };
}

export async function saveGoogleCalendarPreferences(
  selectedCalendarIds: string[]
): Promise<void> {
  const { supabase, userId } = await authenticatedClient();

  if (
    !Array.isArray(selectedCalendarIds) ||
    selectedCalendarIds.length > 100 ||
    !selectedCalendarIds.every(
      (id) => typeof id === "string" &&
        id.trim().length > 0 &&
        id.length <= 1024
    ) ||
    new Set(selectedCalendarIds).size !== selectedCalendarIds.length
  ) {
    throw new Error("Seleção de calendários inválida.");
  }

  const { error } = await supabase
    .from("google_calendar_preferences")
    .upsert(
      {
        user_id: userId,
        selected_calendar_ids: selectedCalendarIds,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

  if (error) {
    throw new Error(
      "Não foi possível salvar as preferências dos calendários."
    );
  }
}
