import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createJourneyDraft } from "@/lib/journey/create-journey-draft";
import { saveConfirmedJourney } from "@/lib/journey/save-confirmed-journey";

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
      typeof input.title !== "string" ||
      (input.targetDate !== undefined && typeof input.targetDate !== "string") ||
      (input.weeklyAvailabilityDays !== undefined && typeof input.weeklyAvailabilityDays !== "number")) {
    return NextResponse.json({ error: "Dados da jornada inválidos." }, { status: 400 });
  }
  let draft;
  try {
    // Rebuild the plan server-side; never trust client-submitted missions or ownership.
    draft = createJourneyDraft({
      title: input.title,
      targetDate: input.targetDate as string | undefined,
      weeklyAvailabilityDays: input.weeklyAvailabilityDays as number | undefined,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Objetivo inválido." }, { status: 400 });
  }
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
  }
  const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error ||
      (assurance.data.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2")) {
    return NextResponse.json({ error: "Verificação adicional necessária." }, { status: 403 });
  }
  try {
    const saved = await saveConfirmedJourney(supabase, draft, true, input.confirmationKey);
    return NextResponse.json({ journey: saved, saved: true }, {
      status: 201,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ error: "Não foi possível salvar a jornada. Verifique suas jornadas antes de tentar novamente." }, { status: 500 });
  }
}
