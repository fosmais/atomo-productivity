import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasCurrentLegalAcceptance } from "@/lib/privacy/legal-acceptance";
import { createJourneyDraft } from "@/lib/journey/create-journey-draft";
import { saveConfirmedJourney } from "@/lib/journey/save-confirmed-journey";
import { loadJourneySnapshot } from "@/lib/journey/journey-snapshot-store";

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return NextResponse.json({ error: "Envie JSON." }, { status: 415 });
  }
  let body: unknown;
  try {
    const raw = await request.text();
    if (raw.length > 4096) return NextResponse.json({ error: "Solicitação muito grande." }, { status: 413 });
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Solicitação inválida." }, { status: 400 });
  }
  const input = body as Record<string, unknown>;
  if (input.confirmed !== true) {
    return NextResponse.json({ error: "Confirmação explícita necessária." }, { status: 400 });
  }
  if (typeof input.confirmationKey !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.confirmationKey) ||
      (input.snapshotId === undefined && typeof input.title !== "string") ||
      (input.snapshotId !== undefined && (typeof input.snapshotId !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.snapshotId))) ||
      (input.snapshotId === undefined && typeof input.plannedOn !== "string") ||
      (input.targetDate !== undefined && typeof input.targetDate !== "string") ||
      (input.weeklyAvailabilityDays !== undefined && typeof input.weeklyAvailabilityDays !== "number")) {
    return NextResponse.json({ error: "Dados da jornada inválidos." }, { status: 400 });
  }
  // Preserve the exact day used to generate the draft the user reviewed.
  // Reject stale or future planning dates rather than silently changing missions.
  const plannedOn = input.snapshotId ? new Date().toISOString().slice(0, 10) : input.plannedOn as string;
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(plannedOn) ? new Date(plannedOn + "T12:00:00Z") : new Date(NaN);
  const today = new Date();
  const todayDay = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const plannedDay = Date.parse(plannedOn + "T00:00:00Z");
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== plannedOn ||
      !Number.isFinite(plannedDay) || plannedDay > todayDay || todayDay - plannedDay > 7 * 86400000) {
    return NextResponse.json({ error: "Prévia expirada ou inválida. Gere uma nova prévia." }, { status: 400 });
  }
  let draft;
  try {
    // Rebuild the plan server-side; never trust client-submitted missions or ownership.
    draft = input.snapshotId ? undefined : createJourneyDraft({
      title: input.title as string,
      targetDate: input.targetDate as string | undefined,
      weeklyAvailabilityDays: input.weeklyAvailabilityDays as number | undefined,
    }, parsed);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Objetivo inválido." }, { status: 400 });
  }
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
  }
  if (process.env.MYRYRA_LEGAL_ACCEPTANCE_GATE_ENABLED === "true" &&
      !(await hasCurrentLegalAcceptance(user.id))) {
    return NextResponse.json(
      { error: "Aceite dos documentos legais vigentes necessário.", code: "LEGAL_ACCEPTANCE_REQUIRED" },
      { status: 403, headers: { "Cache-Control": "private, no-store" } },
    );
  }
  const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error ||
      (assurance.data.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2")) {
    return NextResponse.json({ error: "Verificação adicional necessária." }, { status: 403 });
  }
  try {
    // For AI drafts, load the exact server-side preview instead of trusting client missions.
    const confirmedDraft = input.snapshotId
      ? await loadJourneySnapshot(supabase, input.snapshotId as string)
      : draft;
    if (!confirmedDraft) throw new Error("Prévia inválida.");
    const saved = await saveConfirmedJourney(supabase, confirmedDraft, true, input.confirmationKey, input.snapshotId as string | undefined);
    return NextResponse.json({ journey: saved, saved: true }, {
      status: 201,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    // Log the underlying server failure without exposing user data or database internals.
    const reason = error instanceof Error ? error.message : "unknown";
    console.error("[journey-confirm] persistence failed", { reason });
    if (/Prévia expirada|Prévia expirada ou indisponível|Snapshot unavailable|Prévia inválida|Origem da prévia não verificada|Assinatura inválida|Assinatura não configurada|Identificador de prévia inválido/i.test(reason)) {
      return NextResponse.json({
        error: "A prévia da MIKA expirou ou não está mais disponível. Gere uma nova prévia antes de confirmar.",
        code: "JOURNEY_PREVIEW_EXPIRED",
      }, { status: 410, headers: { "Cache-Control": "no-store" } });
    }
    if (/Autenticação necessária|Authentication and snapshot required/i.test(reason)) {
      return NextResponse.json({ error: "Sua sessão expirou. Entre novamente e tente salvar a jornada.", code: "JOURNEY_AUTH_REQUIRED" }, { status: 401 });
    }
    return NextResponse.json({
      error: "Não foi possível salvar a jornada. " + (/^Falha na gravação da jornada \(código [A-Z0-9_]+\)\.$/.test(reason) ? reason : "Verifique suas jornadas antes de tentar novamente."),
      code: "JOURNEY_SAVE_FAILED",
    }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
