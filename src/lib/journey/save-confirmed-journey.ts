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
  snapshotId?: string,
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

  if (!confirmationKey) throw new Error("Chave de confirmação necessária.");

  // A single PostgreSQL RPC transaction creates the journey and all missions,
  // or rolls everything back. SECURITY INVOKER preserves the table RLS policies.
  const { data, error } = await supabase.rpc(snapshotId ? "myryra_confirm_journey_snapshot_atomic" : "myryra_confirm_journey_atomic", {
    p_title: draft.title,
    p_target_date: draft.targetDate ?? null,
    p_confirmation_key: confirmationKey,
    p_mission_titles: draft.missions.map((mission) => mission.title),
    ...(snapshotId ? { p_snapshot_id: snapshotId } : {}),
  });
  if (error) {
    // Supabase/PostgREST codes are safe to log; never log the draft, user or tokens.
    console.error("[journey-confirm] atomic RPC error", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      snapshot: Boolean(snapshotId),
      missionCount: draft.missions.length,
    });
    if (error.code === "22023" && /Snapshot unavailable/i.test(error.message)) {
      throw new Error("Prévia expirada. Gere uma nova prévia da MIKA.");
    }
    throw new Error("Não foi possível salvar a jornada e suas missões.");
  }
  if (!Array.isArray(data) || data.length !== 1 ||
      typeof data[0]?.journey_id !== "string" ||
      data[0]?.mission_count !== draft.missions.length) {
    console.error("[journey-confirm] unexpected RPC result", {
      snapshot: Boolean(snapshotId),
      missionCount: draft.missions.length,
      resultCount: Array.isArray(data) ? data.length : -1,
    });
    throw new Error("Não foi possível salvar a jornada e suas missões.");
  }
  return { id: data[0].journey_id, missionCount: data[0].mission_count };
}
