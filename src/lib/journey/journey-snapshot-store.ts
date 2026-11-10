import type { SupabaseClient } from "@supabase/supabase-js";
import type { JourneyDraft } from "./create-journey-draft";

const MAX_AGE_MS = 15 * 60 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Server-only adapter for an owner-scoped draft snapshot.
 * Requires myryra_journey_draft_snapshots and owner RLS before activation.
 * Never trust a draft supplied by the client on confirmation.
 */
export async function storeJourneySnapshot(
  supabase: SupabaseClient,
  draft: JourneyDraft,
): Promise<string> {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Autenticação necessária.");
  if (!draft.requiresUserConfirmation || draft.missions.length < 2 ||
      draft.missions.length > 104 || draft.missions.length !== draft.weeks * 2 ||
      draft.missions.some((m) => m.status !== "pending" || !m.title.trim() || m.title.length > 160)) {
    throw new Error("Prévia inválida.");
  }
  const expiresAt = new Date(Date.now() + MAX_AGE_MS).toISOString();
  const { data, error } = await supabase.from("myryra_journey_draft_snapshots")
    .insert({ owner_id: user.id, draft, expires_at: expiresAt })
    .select("id").single();
  if (error || typeof data?.id !== "string" || !UUID.test(data.id)) {
    throw new Error("Não foi possível proteger a prévia.");
  }
  return data.id;
}

export async function loadJourneySnapshot(
  supabase: SupabaseClient,
  snapshotId: string,
): Promise<JourneyDraft> {
  if (!UUID.test(snapshotId)) throw new Error("Identificador de prévia inválido.");
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Autenticação necessária.");
  const { data, error } = await supabase.from("myryra_journey_draft_snapshots")
    .select("draft,expires_at")
    .eq("id", snapshotId).eq("owner_id", user.id).maybeSingle();
  if (error || !data || typeof data.expires_at !== "string" ||
      !Number.isFinite(Date.parse(data.expires_at)) ||
      Date.parse(data.expires_at) <= Date.now()) {
    throw new Error("Prévia expirada ou indisponível.");
  }
  const draft: unknown = data.draft;
  if (!draft || typeof draft !== "object" || Array.isArray(draft)) {
    throw new Error("Prévia inválida.");
  }
  const value = draft as Partial<JourneyDraft>;
  if (value.requiresUserConfirmation !== true || typeof value.title !== "string" ||
      !Number.isInteger(value.weeks) || !Array.isArray(value.missions) ||
      value.missions.length !== (value.weeks as number) * 2 ||
      value.missions.length > 104 || value.missions.some((m) =>
        !m || typeof m.title !== "string" || !m.title.trim() ||
        m.title.length > 160 || m.status !== "pending")) {
    throw new Error("Prévia inválida.");
  }
  return value as JourneyDraft;
}
