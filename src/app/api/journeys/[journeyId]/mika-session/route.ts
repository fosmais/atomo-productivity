import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import { buildMikaJourneySessionPrompt } from "@/lib/journey/mika-session-context";
import { hasCurrentLegalAcceptance } from "@/lib/privacy/legal-acceptance";
import { checkConciergeRateLimit } from "@/lib/rate-limit";

type Context = { params: Promise<{ journeyId: string }> };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Turn = { role: "user" | "assistant"; content: string };

export async function POST(request: Request, context: Context) {
  const { journeyId } = await context.params;
  if (!uuid.test(journeyId)) return NextResponse.json({ error: "Jornada inválida." }, { status: 400 });
  if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json"))
    return NextResponse.json({ error: "Envie JSON." }, { status: 415 });
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
  const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error || (assurance.data.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2"))
    return NextResponse.json({ error: "Verificação adicional necessária." }, { status: 403 });
  if (process.env.MYRYRA_LEGAL_ACCEPTANCE_GATE_ENABLED === "true" && !(await hasCurrentLegalAcceptance(user.id)))
    return NextResponse.json({ error: "Aceite legal necessário.", code: "LEGAL_ACCEPTANCE_REQUIRED" }, { status: 403 });
  let payload: unknown;
  try {
    const raw = await request.text();
    if (raw.length > 12000) return NextResponse.json({ error: "Mensagem muito grande." }, { status: 413 });
    payload = JSON.parse(raw);
  } catch { return NextResponse.json({ error: "JSON inválido." }, { status: 400 }); }
  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  const input = payload as Record<string, unknown>;
  if (typeof input.missionId !== "string" || !uuid.test(input.missionId) ||
      !Array.isArray(input.messages) || input.messages.length > 12 ||
      !input.messages.every((m: unknown) => m && typeof m === "object" &&
        ("role" in m) && ((m as Turn).role === "user" || (m as Turn).role === "assistant") &&
        typeof (m as Turn).content === "string" && (m as Turn).content.trim().length >= 1 && (m as Turn).content.length <= 1500))
    return NextResponse.json({ error: "Conversa inválida." }, { status: 400 });
  const messages = input.messages as Turn[];
  // The first AI greeting may precede the first learner reply. Accept both
  // assistant-first and learner-first histories while enforcing strict alternation.
  const firstRole = messages[0]?.role;
  if (messages.some((turn, index) => turn.role !== (index % 2 === 0 ? firstRole : (firstRole === "user" ? "assistant" : "user"))))
    return NextResponse.json({ error: "A conversa deve alternar mensagens do usuário e da MIKA." }, { status: 400 });
  if (messages.length && messages[messages.length - 1].role !== "user")
    return NextResponse.json({ error: "A última mensagem deve ser do usuário." }, { status: 400 });
  const { data: journey, error: journeyError } = await supabase.from("myryra_journeys")
    .select("id,title,status").eq("id", journeyId).eq("owner_id", user.id).maybeSingle();
  if (journeyError) return NextResponse.json({ error: "Falha ao consultar jornada." }, { status: 503 });
  if (!journey) return NextResponse.json({ error: "Jornada não encontrada." }, { status: 404 });
  if (journey.status !== "active") return NextResponse.json({ error: "Retome a jornada para iniciar a aula." }, { status: 409 });
  const { data: mission, error: missionError } = await supabase.from("myryra_journey_missions")
    .select("id,title,status").eq("journey_id", journeyId).eq("id", input.missionId).maybeSingle();
  if (missionError) return NextResponse.json({ error: "Falha ao consultar missão." }, { status: 503 });
  if (!mission) return NextResponse.json({ error: "Missão não encontrada." }, { status: 404 });
  if (mission.status !== "pending") return NextResponse.json({ error: "Esta missão já foi concluída. Escolha uma missão pendente para iniciar uma nova aula." }, { status: 409 });
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "MIKA indisponível." }, { status: 503 });
  try {
    const limit = await checkConciergeRateLimit(user.id);
    if (!limit.allowed) return NextResponse.json({ error: "Limite temporário de sessões atingido." }, { status: 429 });
  } catch { return NextResponse.json({ error: "Controle de uso indisponível." }, { status: 503 }); }
  try {
    const system = buildMikaJourneySessionPrompt({ journeyTitle: journey.title, missionTitle: mission.title });
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 20000, maxRetries: 0 });
    const response = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [{ role: "system", content: system }, ...(messages.length ? messages : [{ role: "user" as const, content: "Inicie a sessão com uma atividade prática." }])],
      max_completion_tokens: 600,
    });
    const answer = response.choices[0]?.message?.content?.trim();
    if (!answer) throw new Error("empty response");
    return NextResponse.json({ reply: answer, missionId: mission.id, completed: false, myraAwarded: false }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return NextResponse.json({ error: "A MIKA não conseguiu responder agora. Tente novamente." }, { status: 503 });
  }
}
