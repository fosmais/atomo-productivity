import { createHmac, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { JourneyDraft } from "./create-journey-draft";

function signature(ownerId: string, draft: JourneyDraft, expiresAt: string): string {
  const key = process.env.JOURNEY_SNAPSHOT_SIGNING_KEY;
  if (!key || Buffer.byteLength(key, "utf8") < 32) throw new Error("Assinatura não configurada.");
  return createHmac("sha256", key).update(JSON.stringify({ ownerId, draft, expiresAt })).digest("hex");
}

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
    .insert({ owner_id: user.id, draft, expires_at: expiresAt, signature: signature(user.id, draft, expiresAt) })
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
    .select("draft,expires_at,signature")
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
      (value.weeks as number) < 1 || (value.weeks as number) > 52 ||
      !value.title.trim() || value.title.length > 120 ||
      typeof value.plannedOn !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(value.plannedOn) ||
      !Number.isFinite(Date.parse(value.plannedOn + "T12:00:00Z")) ||
      new Date(value.plannedOn + "T12:00:00Z").toISOString().slice(0, 10) !== value.plannedOn ||
      value.missions.length > 104 ||
      new Set(value.missions.map((m) => m?.id)).size !== value.missions.length ||
      value.missions.some((m) =>
        !m || typeof m.title !== "string" || !m.title.trim() ||
        m.title.length > 160 || m.status !== "pending")) {
    throw new Error("Prévia inválida.");
  }
  if (typeof data.signature !== "string" || !/^[0-9a-f]{64}$/.test(data.signature)) {
    throw new Error("Assinatura inválida.");
  }
  const expected = Buffer.from(signature(user.id, value as JourneyDraft, data.expires_at), "hex");
  const actual = Buffer.from(data.signature, "hex");
  if (!timingSafeEqual(expected, actual)) throw new Error("Origem da prévia não verificada.");
  return value as JourneyDraft;
}
