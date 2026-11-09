import type { SupabaseClient } from "@supabase/supabase-js";
import type { JourneyDraft } from "./create-journey-draft";

export type SavedJourney = { id: string; missionCount: number };

/**
 * Call only from a trusted server action after the user has reviewed and
 * explicitly confirmed the draft. The database RLS policies remain mandatory.
 */
export async function saveConfirmedJourney(
  supabase: SupabaseClient,
  draft: JourneyDraft,
  confirmed: boolean,
): Promise<SavedJourney> {
  if (!confirmed) throw new Error("Confirme a jornada antes de salvar.");
  if (!draft.requiresUserConfirmation || !draft.title.trim() ||
      draft.title.length > 160 || draft.missions.length < 1 ||
      draft.missions.length > 104) {
    throw new Error("Rascunho de jornada inválido.");
  }
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Autenticação necessária.");

  const { data: journey, error: journeyError } = await supabase
    .from("myryra_journeys")
    .insert({ owner_id: user.id, title: draft.title, status: "active", visibility: "private" })
    .select("id")
    .single();
  if (journeyError || !journey) throw new Error("Não foi possível salvar a jornada.");

  const { error: missionsError } = await supabase.from("myryra_journey_missions")
    .insert(draft.missions.map((mission) => ({
      journey_id: journey.id,
      title: mission.title,
      status: "pending",
    })));
  if (missionsError) {
    // Best-effort cleanup; if it fails, surface the orphaned journey ID
    // to allow reconciliation rather than silently claiming rollback.
    const { error: cleanupError } = await supabase.from("myryra_journeys")
      .delete().eq("id", journey.id).eq("owner_id", user.id);
    if (cleanupError) throw new Error(`Missões não salvas; verificar jornada ${journey.id}.`);
    throw new Error("Não foi possível salvar as missões; jornada revertida.");
  }
  return { id: journey.id, missionCount: draft.missions.length };
}
