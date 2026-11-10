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
  confirmationKey?: string,
): Promise<SavedJourney> {
  if (confirmationKey !== undefined && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(confirmationKey)) {
    throw new Error("Chave de confirmação inválida.");
  }
  if (!confirmed) throw new Error("Confirme a jornada antes de salvar.");
  if (!draft.requiresUserConfirmation || !draft.title.trim() ||
      draft.title.length > 120 ||
      (draft.targetDate !== undefined && (!/^\d{4}-\d{2}-\d{2}$/.test(draft.targetDate) ||
        Number.isNaN(Date.parse(draft.targetDate + "T12:00:00Z")) ||
        new Date(draft.targetDate + "T12:00:00Z").toISOString().slice(0, 10) !== draft.targetDate)) ||
      draft.missions.length < 1 ||
      draft.missions.length > 104 ||
      draft.missions.some((m) => !m.title.trim() || m.title.length > 160 || m.status !== "pending")) {
    throw new Error("Rascunho de jornada inválido.");
  }
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Autenticação necessária.");

  const { data: journey, error: journeyError } = await supabase
    .from("myryra_journeys")
    .insert({ owner_id: user.id, title: draft.title, target_date: draft.targetDate ?? null, status: "active", visibility: "private", ...(confirmationKey ? { confirmation_key: confirmationKey } : {}) })
    .select("id")
    .single();
  if (journeyError || !journey) {
    if (confirmationKey && journeyError?.code === "23505") {
      const { data: existing, error: existingError } = await supabase
        .from("myryra_journeys")
        .select("id,title,target_date")
        .eq("owner_id", user.id)
        .eq("confirmation_key", confirmationKey)
        .maybeSingle();
      if (!existingError && existing) {
        if (existing.title !== draft.title || existing.target_date !== (draft.targetDate ?? null)) {
          throw new Error("Esta confirmação já foi usada para outro objetivo.");
        }
        const { data: storedMissions, error: missionsReadError } = await supabase
          .from("myryra_journey_missions")
          .select("title")
          .eq("journey_id", existing.id);
        if (!missionsReadError && storedMissions && storedMissions.length === draft.missions.length) {
          const expectedTitles = draft.missions.map((mission) => mission.title).sort();
          const storedTitles = storedMissions.map((mission) => mission.title).sort();
          if (expectedTitles.every((title, index) => title === storedTitles[index])) {
            return { id: existing.id, missionCount: storedMissions.length };
          }
          throw new Error("Esta confirmação já foi usada para um planejamento diferente.");
        }
        throw new Error("Confirmação em processamento. Aguarde antes de tentar novamente.");
      }
    }
    throw new Error("Não foi possível salvar a jornada.");
  }

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
