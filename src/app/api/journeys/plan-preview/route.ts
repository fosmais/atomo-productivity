import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireCurrentLegalAcceptance } from "@/lib/legal/require-current-acceptance";

const headers = { "Cache-Control": "no-store" };

/** A deterministic, editable fallback. It does not call AI or persist anything. */
export async function POST(request: Request) {
  if (process.env.MYRYRA_JOURNEY_ENABLED !== "true") return NextResponse.json({ error: "Journey indisponível." }, { status: 404, headers });
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Autenticação necessária." }, { status: 401, headers });
  const consent = await requireCurrentLegalAcceptance(user.id);
  if (!consent.allowed) return NextResponse.json({ error: consent.reason }, { status: consent.reason === "ACCEPTANCE_REQUIRED" ? 403 : 503, headers });
  if ((request.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase() !== "application/json") return NextResponse.json({ error: "JSON obrigatório." }, { status: 415, headers });
  const length = request.headers.get("content-length");
  if (length !== null && (!Number.isSafeInteger(Number(length)) || Number(length) < 0)) return NextResponse.json({ error: "Tamanho inválido." }, { status: 400, headers });
  if (length !== null && Number(length) > 2048) return NextResponse.json({ error: "Requisição muito grande." }, { status: 413, headers });
  let input: unknown;
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
      if (bytes > 2048) { await reader.cancel(); return NextResponse.json({ error: "Requisição muito grande." }, { status: 413, headers }); }
      raw += decoder.decode(part.value, { stream: true });
    }
    input = JSON.parse(raw + decoder.decode());
  } catch { return NextResponse.json({ error: "JSON inválido." }, { status: 400, headers }); }
  if (!input || typeof input !== "object" || Array.isArray(input)) return NextResponse.json({ error: "Dados inválidos." }, { status: 400, headers });
  const { goal, weeks, minutesPerDay, daysPerWeek } = input as { goal?: unknown; weeks?: unknown; minutesPerDay?: unknown; daysPerWeek?: unknown };
  if (typeof goal !== "string" || !goal.trim() || goal.trim().length > 120 || !Number.isInteger(weeks) || typeof weeks !== "number" || weeks < 1 || weeks > 52) {
    return NextResponse.json({ error: "Informe um objetivo e um prazo entre 1 e 52 semanas." }, { status: 400, headers });
  }
  if (minutesPerDay !== undefined && (typeof minutesPerDay !== "number" || !Number.isInteger(minutesPerDay) || minutesPerDay < 5 || minutesPerDay > 240)) return NextResponse.json({ error: "Tempo diário deve ser entre 5 e 240 minutos." }, { status: 400, headers });
  if (daysPerWeek !== undefined && (typeof daysPerWeek !== "number" || !Number.isInteger(daysPerWeek) || daysPerWeek < 1 || daysPerWeek > 7)) return NextResponse.json({ error: "Dias por semana devem ser entre 1 e 7." }, { status: 400, headers });
  const daily = minutesPerDay ?? 20;
  const weekly = daysPerWeek ?? 3;
  const clean = goal.trim();
  const normalized = clean.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const category = /italiano|ingles|espanhol|frances|idioma|lingua/.test(normalized) ? "language"
    : /correr|corrida|maratona|5 km|10 km|quilometro/.test(normalized) ? "running"
    : /economizar|juntar|poupar|reserva|dinheiro|r\$|investir/.test(normalized) ? "savings"
    : /mudar de pais|morar fora|imigrar|mudanca de pais|italia|exterior/.test(normalized) ? "relocation"
    : "general";
  const templates: Record<string, [string[], string[], string[]]> = {
    language: [
      ["Avaliar seu nível atual e definir uma rotina de estudo", "Escolher materiais e praticar 10 minutos de vocabulário"],
      ["Praticar escuta e conversação em sessões semanais", "Registrar novas palavras e revisar os pontos difíceis"],
      ["Realizar uma conversa ou exercício de nível compatível", "Revisar sua evolução e planejar a próxima etapa"],
    ],
    running: [
      ["Avaliar seu condicionamento e definir uma distância inicial segura", "Reservar dias de treino e descanso na agenda"],
      ["Evoluir gradualmente a distância, respeitando a recuperação", "Registrar treinos e ajustar o ritmo conforme seu conforto"],
      ["Realizar um treino de avaliação sem ultrapassar seus limites", "Revisar sua evolução e definir o próximo ciclo"],
    ],
    savings: [
      ["Definir valor-alvo e prazo para sua reserva", "Levantar receitas, despesas e quanto pode poupar"],
      ["Estabelecer uma contribuição periódica compatível com o orçamento", "Revisar gastos e acompanhar o valor acumulado"],
      ["Comparar o valor acumulado com a meta", "Revisar o plano financeiro para o próximo período"],
    ],
    relocation: [
      ["Escolher país e pesquisar requisitos oficiais de residência", "Mapear documentação, idioma e orçamento necessário"],
      ["Organizar uma lista de documentos e prazos", "Planejar custos, moradia e oportunidades com fontes verificadas"],
      ["Revisar pendências e confirmar requisitos atualizados", "Preparar o próximo conjunto de providências"],
    ],
    general: [
      ["Definir um resultado mensurável para: " + clean, "Reservar tempo na semana para avançar"],
      ["Executar uma pequena ação relacionada ao objetivo", "Revisar obstáculos e ajustar o plano"],
      ["Revisar o que foi conquistado", "Definir a próxima etapa da jornada"],
    ],
  };
  const steps = templates[category].map(items => [...items]) as [string[], string[], string[]];
  steps[0].push(`Reservar ${daily} minutos em ${weekly} dia(s) por semana para a jornada`);
  const stages = [
    { title: "Preparar a jornada", week: 1, missions: steps[0] },
    { title: "Criar consistência", week: Math.min(weeks, Math.max(1, Math.ceil(weeks / 3))), missions: steps[1] },
    { title: "Consolidar o progresso", week: weeks, missions: steps[2] },
  ];
  return NextResponse.json({ goal: clean, weeks, source: "category_template", category, availability: { minutesPerDay: daily, daysPerWeek: weekly }, requiresConfirmation: true, persisted: false, stages }, { headers });
}
