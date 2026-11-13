import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function previewDatabaseIsUnsafe() {
  if (process.env.VERCEL_ENV !== "preview") return false;
  if (process.env.MIKA_TEACHER_HOMOLOGATION_READY !== "true") return true;
  return process.env.NEXT_PUBLIC_SUPABASE_URL !== "https://xanavauqzsrgvdfhcrsm.supabase.co";
}


const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function authenticatedClient() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { error: NextResponse.json({ error: "Autenticação necessária." }, { status: 401 }) };
  const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error) return { error: NextResponse.json({ error: "Verificação indisponível." }, { status: 503 }) };
  if (assurance.data.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2")
    return { error: NextResponse.json({ error: "Verificação adicional necessária." }, { status: 403 }) };
  return { supabase, user };
}

export async function GET(request: Request) {
  if (previewDatabaseIsUnsafe()) return NextResponse.json({ error: "Preview bloqueado: Supabase de homologação não configurado." }, { status: 503 });
  const auth = await authenticatedClient();
  if (auth.error) return auth.error;
  const { supabase, user } = auth;
  const url = new URL(request.url);
  const journeyId = url.searchParams.get("journeyId");
  if (journeyId !== null && !uuid.test(journeyId))
    return NextResponse.json({ error: "Jornada inválida." }, { status: 400 });
  if (journeyId) {
    const { data: journey, error: journeyError } = await supabase.from("myryra_journeys")
      .select("id").eq("id", journeyId).eq("owner_id", user.id).maybeSingle();
    if (journeyError) return NextResponse.json({ error: "Falha ao consultar jornada." }, { status: 500 });
    if (!journey) return NextResponse.json({ error: "Jornada não encontrada." }, { status: 404 });
  }
  let query = supabase.from("mika_teacher_sessions")
    .select("id,journey_id,topic,level,status,scheduled_at,created_at,updated_at")
    .eq("owner_id", user.id);
  query = journeyId ? query.eq("journey_id", journeyId) : query.is("journey_id", null);
  const { data, error } = await query.order("created_at", { ascending: false }).limit(30);
  if (error) return NextResponse.json({ error: "Histórico indisponível. Verifique se a migração foi aplicada." }, { status: 503 });
  return NextResponse.json({ sessions: data ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  if (previewDatabaseIsUnsafe()) return NextResponse.json({ error: "Preview bloqueado: Supabase de homologação não configurado." }, { status: 503 });
  const auth = await authenticatedClient();
  if (auth.error) return auth.error;
  const { supabase, user } = auth;
  if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json"))
    return NextResponse.json({ error: "Envie JSON." }, { status: 415 });
  let body: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (raw.length > 1024) return NextResponse.json({ error: "Solicitação muito grande." }, { status: 413 });
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw Error("invalid");
    body = parsed as Record<string, unknown>;
  } catch { return NextResponse.json({ error: "JSON inválido." }, { status: 400 }); }
  if (body.journeyId !== undefined && body.journeyId !== null && (typeof body.journeyId !== "string" || !uuid.test(body.journeyId)) ||
      typeof body.topic !== "string" || !body.topic.trim() || body.topic.length > 120 ||
      (body.scheduledAt !== undefined && (typeof body.scheduledAt !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(body.scheduledAt) || !Number.isFinite(Date.parse(body.scheduledAt)) || Date.parse(body.scheduledAt) < Date.now() + 60000 || Date.parse(body.scheduledAt) > Date.now() + 366 * 86400000)) ||
      (body.level !== undefined && (typeof body.level !== "string" || !body.level.trim() || body.level.length > 40)))
    return NextResponse.json({ error: "Dados da aula inválidos." }, { status: 400 });
  let journeyId: string | null = null;
  if (typeof body.journeyId === "string") {
    const { data: journey, error: journeyError } = await supabase.from("myryra_journeys")
      .select("id,status").eq("id", body.journeyId).eq("owner_id", user.id).maybeSingle();
    if (journeyError) return NextResponse.json({ error: "Falha ao consultar jornada." }, { status: 500 });
    if (!journey) return NextResponse.json({ error: "Jornada não encontrada." }, { status: 404 });
    if (journey.status !== "active") return NextResponse.json({ error: "Retome a jornada antes de criar aulas." }, { status: 409 });
    journeyId = journey.id;
  }
  const { data, error } = await supabase.from("mika_teacher_sessions")
    .insert({ owner_id: user.id, journey_id: journeyId, topic: body.topic.trim(), level: typeof body.level === "string" ? body.level.trim() : "iniciante", scheduled_at: typeof body.scheduledAt === "string" ? body.scheduledAt : null })
    .select("id,journey_id,topic,level,status,scheduled_at,created_at").single();
  if (error) return NextResponse.json({ error: "Não foi possível criar sessão. Verifique se a migração foi aplicada." }, { status: 503 });
  return NextResponse.json({ session: data }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
}
