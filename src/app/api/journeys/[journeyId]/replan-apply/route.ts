import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasCurrentLegalAcceptance } from "@/lib/privacy/legal-acceptance";
import { createJourneyDraft } from "@/lib/journey/create-journey-draft";

type Context = { params: Promise<{ journeyId: string }> };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Apply only a freshly reviewed, server-generated replan. */
export async function POST(request: Request, context: Context) {
  const { journeyId } = await context.params;
  if (!uuid.test(journeyId)) return NextResponse.json({ error: "Jornada inválida." }, { status: 400 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Dados inválidos." }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  const revision = (body as Record<string, unknown>).revision;
  if (typeof revision !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(revision) || !Number.isFinite(Date.parse(revision)))
    return NextResponse.json({ error: "Atualize a prévia antes de confirmar." }, { status: 400 });

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
  if (process.env.MYRYRA_LEGAL_ACCEPTANCE_GATE_ENABLED === "true" &&
      !(await hasCurrentLegalAcceptance(user.id))) {
    return NextResponse.json(
      { error: "Aceite dos documentos legais vigentes necessário.", code: "LEGAL_ACCEPTANCE_REQUIRED" },
      { status: 403, headers: { "Cache-Control": "private, no-store" } },
    );
  }
  const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error || (assurance.data.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2"))
    return NextResponse.json({ error: "Verificação adicional necessária." }, { status: 403 });

  const { data: journey, error: journeyError } = await supabase.from("myryra_journeys")
    .select("id,title,target_date,status,updated_at").eq("id", journeyId)
    .eq("owner_id", user.id).eq("status", "active").maybeSingle();
  if (journeyError) return NextResponse.json({ error: "Falha ao consultar a jornada." }, { status: 500 });
  if (!journey) return NextResponse.json({ error: "Jornada ativa não encontrada." }, { status: 404 });
  if (journey.updated_at !== revision) return NextResponse.json({ error: "A jornada mudou. Gere uma nova prévia." }, { status: 409 });

  const { data: missions, error: missionError } = await supabase.from("myryra_journey_missions")
    .select("id,title,status").eq("journey_id", journeyId).order("created_at", { ascending: true }).limit(105);
  if (missionError) return NextResponse.json({ error: "Falha ao consultar missões." }, { status: 500 });
  if ((missions ?? []).length > 104) return NextResponse.json({ error: "Limite de missões excedido." }, { status: 409 });

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  if (journey.target_date && journey.target_date < today)
    return NextResponse.json({ error: "Atualize a data-alvo vencida antes de confirmar." }, { status: 409 });
  const draft = createJourneyDraft({ title: journey.title, targetDate: journey.target_date ?? undefined }, now);
  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .trim().replace(/\s+/g, " ").toLowerCase();
  const completed = new Set((missions ?? []).filter(m => m.status === "completed").map(m => normalize(m.title)));
  const titles = draft.missions.filter(m => !completed.has(normalize(m.title))).map(m => m.title);
  if (titles.length < 1) return NextResponse.json({ error: "Nenhuma nova missão a aplicar." }, { status: 409 });

  const { data, error } = await supabase.rpc("myryra_apply_journey_replan_atomic", {
    p_journey_id: journeyId,
    p_expected_updated_at: revision,
    p_mission_titles: titles,
  });
  if (error) return NextResponse.json({
    error: error.code === "42883" ? "Replanejamento ainda não habilitado no banco." :
      "Não foi possível confirmar. Atualize a prévia e tente novamente.",
  }, { status: error.code === "42883" ? 503 : 409 });
  return NextResponse.json({ applied: true, result: data, message: "Novo caminho confirmado. Conquistas preservadas." },
    { headers: { "Cache-Control": "private, no-store" } });
}
