import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireCurrentLegalAcceptance } from "@/lib/legal/require-current-acceptance";

const headers = { "Cache-Control": "no-store" };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Params = { params: Promise<{ journeyId: string; missionId: string }> };

async function authorize(params: Params["params"]) {
  if (process.env.MYRYRA_JOURNEY_ENABLED !== "true") return { response: NextResponse.json({ error: "Journey indisponível." }, { status: 404, headers }) };
  const { journeyId, missionId } = await params;
  if (!uuid.test(journeyId) || !uuid.test(missionId)) return { response: NextResponse.json({ error: "Identificador inválido." }, { status: 400, headers }) };
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { response: NextResponse.json({ error: "Autenticação necessária." }, { status: 401, headers }) };
  const consent = await requireCurrentLegalAcceptance(user.id);
  if (!consent.allowed) return { response: NextResponse.json({ error: consent.reason }, { status: consent.reason === "ACCEPTANCE_REQUIRED" ? 403 : 503, headers }) };
  const { data: mission, error: missionError } = await supabase.from("myryra_journey_missions").select("id,journey_id").eq("id", missionId).eq("journey_id", journeyId).maybeSingle();
  if (missionError) return { response: NextResponse.json({ error: "Missão indisponível." }, { status: 503, headers }) };
  const { data: journey, error: journeyError } = await supabase.from("myryra_journeys").select("id,status").eq("id", journeyId).eq("owner_id", user.id).maybeSingle();
  if (journeyError) return { response: NextResponse.json({ error: "Jornada indisponível." }, { status: 503, headers }) };
  if (!mission || !journey) return { response: NextResponse.json({ error: "Missão não encontrada." }, { status: 404, headers }) };
  return { supabase, user, mission, journey };
}

export async function GET(_request: Request, { params }: Params) {
  const ctx = await authorize(params);
  if (ctx.response) return ctx.response;
  const { data, error } = await ctx.supabase!.from("myryra_journey_task_links").select("task_id,created_at").eq("mission_id", ctx.mission!.id).maybeSingle();
  if (error) return NextResponse.json({ error: "Vínculo indisponível." }, { status: 503, headers });
  return NextResponse.json({ link: data }, { headers });
}

export async function POST(request: Request, { params }: Params) {
  const ctx = await authorize(params);
  if (ctx.response) return ctx.response;
  if (ctx.journey!.status !== "active") return NextResponse.json({ error: "Jornada não está ativa." }, { status: 409, headers });
  if ((request.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase() !== "application/json") return NextResponse.json({ error: "JSON obrigatório." }, { status: 415, headers });
  const length = request.headers.get("content-length");
  if (length !== null && (!Number.isSafeInteger(Number(length)) || Number(length) > 256 || Number(length) < 0)) return NextResponse.json({ error: "Requisição muito grande ou inválida." }, { status: 413, headers });
  let payload: unknown;
  try {
    const reader = request.body?.getReader();
    if (!reader) throw new Error("Corpo ausente");
    const decoder = new TextDecoder("utf-8", { fatal: true });
    let raw = "";
    let bytes = 0;
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > 256) {
        await reader.cancel();
        return NextResponse.json({ error: "Requisição muito grande." }, { status: 413, headers });
      }
      raw += decoder.decode(part.value, { stream: true });
    }
    payload = JSON.parse(raw + decoder.decode());
  } catch { return NextResponse.json({ error: "JSON inválido." }, { status: 400, headers }); }
  const taskId = payload && typeof payload === "object" && !Array.isArray(payload) && "taskId" in payload ? (payload as { taskId: unknown }).taskId : null;
  if (typeof taskId !== "string" || !uuid.test(taskId)) return NextResponse.json({ error: "Tarefa inválida." }, { status: 400, headers });
  const { data: task, error: taskError } = await ctx.supabase!.from("tasks").select("id").eq("id", taskId).eq("user_id", ctx.user!.id).is("deleted_at", null).maybeSingle();
  if (taskError) return NextResponse.json({ error: "Tarefa indisponível." }, { status: 503, headers });
  if (!task) return NextResponse.json({ error: "Tarefa não encontrada." }, { status: 404, headers });
  const { data: existing, error: lookupError } = await ctx.supabase!.from("myryra_journey_task_links").select("task_id").eq("mission_id", ctx.mission!.id).maybeSingle();
  if (lookupError) return NextResponse.json({ error: "Vínculo indisponível." }, { status: 503, headers });
  if (existing) return NextResponse.json(existing.task_id === taskId ? { link: existing, unchanged: true } : { error: "Missão já vinculada a outra tarefa." }, { status: existing.task_id === taskId ? 200 : 409, headers });
  const { data, error } = await ctx.supabase!.from("myryra_journey_task_links").insert({ mission_id: ctx.mission!.id, task_id: taskId, owner_id: ctx.user!.id }).select("mission_id,task_id,created_at").single();
  if (error) return NextResponse.json({ error: error.code === "23505" ? "Tarefa ou missão já vinculada." : "Não foi possível vincular a tarefa." }, { status: error.code === "23505" ? 409 : 503, headers });
  return NextResponse.json({ link: data }, { status: 201, headers });
}
