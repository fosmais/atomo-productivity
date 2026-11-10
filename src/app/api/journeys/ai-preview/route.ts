import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createJourneyDraft } from "@/lib/journey/create-journey-draft";
import { generateSuggestedJourney } from "@/lib/journey/generate-suggested-journey";
import { storeJourneySnapshot } from "@/lib/journey/journey-snapshot-store";
import { checkConciergeRateLimit } from "@/lib/rate-limit";

/**
 * Opt-in AI preview endpoint. Never persists a confirmed journey.
 * Confirmation must use the owner-scoped snapshot ID, not client missions.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
  const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error) return NextResponse.json({ error: "Verificação de sessão indisponível." }, { status: 503 });
  if (assurance.data.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2") {
    return NextResponse.json({ error: "Verificação adicional necessária." }, { status: 403 });
  }
  try {
    const limit = await checkConciergeRateLimit(user.id);
    if (!limit.allowed) {
      return NextResponse.json({ error: "Limite de requisições atingido." }, {
        status: 429,
        headers: { "Retry-After": String(Math.max(1, Math.ceil((limit.reset - Date.now()) / 1000))) },
      });
    }
  } catch {
    return NextResponse.json({ error: "Serviço temporariamente indisponível." }, { status: 503 });
  }
  if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) {
    return NextResponse.json({ error: "Envie JSON." }, { status: 415 });
  }
  let input: unknown;
  try {
    const raw = await request.text();
    if (raw.length > 4096) return NextResponse.json({ error: "Solicitação muito grande." }, { status: 413 });
    input = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return NextResponse.json({ error: "Objetivo inválido." }, { status: 400 });
  }
  const data = input as Record<string, unknown>;
  if (typeof data.title !== "string" ||
      (data.targetDate !== undefined && typeof data.targetDate !== "string") ||
      (data.weeklyAvailabilityDays !== undefined && typeof data.weeklyAvailabilityDays !== "number")) {
    return NextResponse.json({ error: "Dados da jornada inválidos." }, { status: 400 });
  }
  let base;
  try {
    base = createJourneyDraft({
      title: data.title,
      targetDate: data.targetDate as string | undefined,
      weeklyAvailabilityDays: data.weeklyAvailabilityDays as number | undefined,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Objetivo inválido." }, { status: 400 });
  }
  if (base.weeks > 12) {
    return NextResponse.json({ error: "A prévia por IA aceita jornadas de até 12 semanas." }, { status: 400 });
  }
  try {
    const draft = await generateSuggestedJourney(base);
    const snapshotId = await storeJourneySnapshot(supabase, draft);
    return NextResponse.json({ draft, snapshotId, saved: false, expiresInSeconds: 900 }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ error: "Não foi possível gerar a prévia por IA. Tente novamente." }, { status: 503 });
  }
}
