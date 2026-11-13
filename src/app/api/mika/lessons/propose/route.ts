import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { proposeMikaLesson } from "@/lib/journey/lesson-plan";

function previewDatabaseIsUnsafe() {
  if (process.env.VERCEL_ENV !== "preview") return false;
  return process.env.NEXT_PUBLIC_SUPABASE_URL !== "https://xanavauqzsrgvdfhcrsm.supabase.co";
}


/** Read-only lesson proposal. Never creates events, awards MYRAs or marks progress. */
export async function POST(request: Request) {
  if (previewDatabaseIsUnsafe()) return NextResponse.json({ error: "Preview bloqueado: Supabase de homologação não configurado." }, { status: 503 });
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
  const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error) return NextResponse.json({ error: "Verificação indisponível." }, { status: 503 });
  if (assurance.data.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2")
    return NextResponse.json({ error: "Verificação adicional necessária." }, { status: 403 });
  if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json"))
    return NextResponse.json({ error: "Envie JSON." }, { status: 415 });
  let input: unknown;
  try {
    const raw = await request.text();
    if (raw.length > 4096) return NextResponse.json({ error: "Solicitação muito grande." }, { status: 413 });
    input = JSON.parse(raw);
  } catch { return NextResponse.json({ error: "JSON inválido." }, { status: 400 }); }
  if (!input || typeof input !== "object" || Array.isArray(input))
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  const data = input as Record<string, unknown>;
  if (data.journeyId !== undefined && data.journeyId !== null && (typeof data.journeyId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data.journeyId)) ||
    (data.topic !== undefined && (typeof data.topic !== "string" || data.topic.length > 120)) ||
    (data.level !== undefined && (typeof data.level !== "string" || data.level.length > 40)) ||
    (data.language !== undefined && (typeof data.language !== "string" || data.language.length > 40)) ||
    (data.durationMinutes !== undefined && typeof data.durationMinutes !== "number") ||
    (data.completedTopics !== undefined && (!Array.isArray(data.completedTopics) ||
      data.completedTopics.length > 30 || !data.completedTopics.every((x: unknown) => typeof x === "string" && x.length <= 120))))
    return NextResponse.json({ error: "Dados da aula inválidos." }, { status: 400 });
  let journey: { id: string; title: string; status: string } | null = null;
  if (typeof data.journeyId === "string") {
    const { data: ownedJourney, error: queryError } = await supabase.from("myryra_journeys")
      .select("id,title,status").eq("id", data.journeyId).eq("owner_id", user.id).maybeSingle();
    if (queryError) return NextResponse.json({ error: "Não foi possível consultar a jornada." }, { status: 500 });
    if (!ownedJourney || ownedJourney.status === "archived")
      return NextResponse.json({ error: "Jornada não encontrada." }, { status: 404 });
    if (ownedJourney.status !== "active")
      return NextResponse.json({ error: "Retome a jornada antes de planejar aulas." }, { status: 409 });
    journey = ownedJourney;
  }
  if (!journey && (typeof data.topic !== "string" || !data.topic.trim()))
    return NextResponse.json({ error: "Informe o assunto da aula livre." }, { status: 400 });
  try {
    const lesson = proposeMikaLesson({
      journeyId: journey?.id ?? "free", goal: journey?.title ?? (data.topic as string),
      topic: data.topic as string | undefined, level: data.level as string | undefined,
      language: data.language as string | undefined,
      durationMinutes: data.durationMinutes as number | undefined,
      completedTopics: data.completedTopics as string[] | undefined,
    });
    return NextResponse.json({ lesson: journey ? lesson : { ...lesson, journeyId: null }, saved: false, scheduled: false }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Dados inválidos." }, { status: 400 });
  }
}
