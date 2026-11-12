import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireCurrentLegalAcceptance } from "@/lib/legal/require-current-acceptance";

const headers = { "Cache-Control": "no-store" };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function context() {
  if (process.env.MYRYRA_JOURNEY_ENABLED !== "true") return { response: NextResponse.json({ error: "Journey indisponível." }, { status: 404, headers }) };
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { response: NextResponse.json({ error: "Autenticação necessária." }, { status: 401, headers }) };
  const consent = await requireCurrentLegalAcceptance(user.id);
  if (!consent.allowed) return { response: NextResponse.json({ error: consent.reason }, { status: consent.reason === "ACCEPTANCE_REQUIRED" ? 403 : 503, headers }) };
  return { supabase, user };
}

async function owner(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, journeyId: string) {
  const { data, error } = await supabase.from("myryra_journeys").select("id,status")
    .eq("id", journeyId).eq("owner_id", userId).maybeSingle();
  return error ? null : data;
}

export async function GET(request: Request, { params }: { params: Promise<{ journeyId: string }> }) {
  const ctx = await context();
  if (ctx.response) return ctx.response;
  const { supabase, user } = ctx;
  const { journeyId } = await params;
  if (!uuid.test(journeyId)) return NextResponse.json({ error: "Jornada inválida." }, { status: 400, headers });
  const journey = await owner(supabase!, user!.id, journeyId);
  if (!journey) return NextResponse.json({ error: "Jornada não encontrada." }, { status: 404, headers });
  const { data, error } = await supabase!.from("myryra_journey_missions")
    .select("id,title,status,due_at,completed_at,created_at").eq("journey_id", journeyId)
    .order("created_at", { ascending: true }).limit(200);
  if (error) return NextResponse.json({ error: "Missões indisponíveis." }, { status: 503, headers });
  const missions = data ?? [];
  // Progress must reflect the entire journey, not only the first page of 200 missions.
  const [allCount, completedCount] = await Promise.all([
    supabase!.from("myryra_journey_missions").select("id", { count: "exact", head: true }).eq("journey_id", journeyId),
    supabase!.from("myryra_journey_missions").select("id", { count: "exact", head: true }).eq("journey_id", journeyId).eq("status", "completed"),
  ]);
  if (allCount.error || completedCount.error || allCount.count === null || completedCount.count === null) {
    return NextResponse.json({ error: "Progresso indisponível." }, { status: 503, headers });
  }
  const total = allCount.count;
  const completed = completedCount.count;
  return NextResponse.json({ journey, missions, progress: { completed, total, percent: total ? Math.round(100 * completed / total) : 0 }, hasMore: total > missions.length }, { headers });
}

export async function POST(request: Request, { params }: { params: Promise<{ journeyId: string }> }) {
  const ctx = await context();
  if (ctx.response) return ctx.response;
  const { supabase, user } = ctx;
  const { journeyId } = await params;
  if (!uuid.test(journeyId)) return NextResponse.json({ error: "Jornada inválida." }, { status: 400, headers });
  const journey = await owner(supabase!, user!.id, journeyId);
  if (!journey) return NextResponse.json({ error: "Jornada não encontrada." }, { status: 404, headers });
  if (journey.status !== "active") return NextResponse.json({ error: "Jornada não está ativa." }, { status: 409, headers });
  if ((request.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase() !== "application/json") {
    return NextResponse.json({ error: "JSON obrigatório." }, { status: 415, headers });
  }
  const length = request.headers.get("content-length");
  if (length !== null && (!Number.isSafeInteger(Number(length)) || Number(length) < 0)) return NextResponse.json({ error: "Tamanho inválido." }, { status: 400, headers });
  if (length !== null && Number(length) > 4096) return NextResponse.json({ error: "Requisição muito grande." }, { status: 413, headers });
  let payload: unknown;
  try {
    const reader = request.body?.getReader();
    if (!reader) throw new Error("Corpo ausente");
    const decoder = new TextDecoder("utf-8", { fatal: true });
    let raw = "";
    let size = 0;
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > 4096) {
        await reader.cancel();
        return NextResponse.json({ error: "Requisição muito grande." }, { status: 413, headers });
      }
      raw += decoder.decode(part.value, { stream: true });
    }
    payload = JSON.parse(raw + decoder.decode());
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400, headers });
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return NextResponse.json({ error: "Dados inválidos." }, { status: 400, headers });
  const body = payload as Record<string, unknown>;
  if (typeof body.title !== "string" || !body.title.trim() || body.title.trim().length > 160 ||
    (body.due_at !== undefined && body.due_at !== null &&
      (typeof body.due_at !== "string" || !Number.isFinite(Date.parse(body.due_at))))) {
    return NextResponse.json({ error: "Missão ou prazo inválido." }, { status: 400, headers });
  }
  const { data, error } = await supabase!.from("myryra_journey_missions")
    .insert({ journey_id: journeyId, title: body.title.trim(), status: "pending", due_at: typeof body.due_at === "string" ? new Date(body.due_at).toISOString() : null })
    .select("id,title,status,due_at,completed_at,created_at").single();
  if (error) return NextResponse.json({ error: "Não foi possível criar a missão." }, { status: 503, headers });
  return NextResponse.json({ mission: data }, { status: 201, headers });
}
