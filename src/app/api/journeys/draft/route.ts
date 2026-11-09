import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createJourneyDraft } from "@/lib/journey/create-journey-draft";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
  }
  const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error ||
      (assurance.data.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2")) {
    return NextResponse.json({ error: "Verificação adicional necessária." }, { status: 403 });
  }
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return NextResponse.json({ error: "Envie JSON." }, { status: 415 });
  }
  const size = Number(request.headers.get("content-length") ?? "0");
  if (size > 4096) return NextResponse.json({ error: "Solicitação muito grande." }, { status: 413 });
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
  try {
    const draft = createJourneyDraft({
      title: data.title,
      targetDate: data.targetDate as string | undefined,
      weeklyAvailabilityDays: data.weeklyAvailabilityDays as number | undefined,
    });
    return NextResponse.json({ draft, saved: false }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Objetivo inválido." }, { status: 400 });
  }
}
