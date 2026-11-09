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
  const { goal, weeks } = input as { goal?: unknown; weeks?: unknown };
  if (typeof goal !== "string" || !goal.trim() || goal.trim().length > 120 || !Number.isInteger(weeks) || typeof weeks !== "number" || weeks < 1 || weeks > 52) {
    return NextResponse.json({ error: "Informe um objetivo e um prazo entre 1 e 52 semanas." }, { status: 400, headers });
  }
  const clean = goal.trim();
  const stages = [
    { title: "Preparar a jornada", week: 1, missions: ["Definir um resultado concreto para: " + clean, "Reservar tempo na semana para avançar"] },
    { title: "Criar consistência", week: Math.min(weeks, Math.max(1, Math.ceil(weeks / 3))), missions: ["Executar uma pequena ação relacionada ao objetivo", "Revisar obstáculos e ajustar o plano"] },
    { title: "Consolidar o progresso", week: weeks, missions: ["Revisar o que foi conquistado", "Definir a próxima etapa da jornada"] },
  ];
  return NextResponse.json({ goal: clean, weeks, source: "deterministic_fallback", requiresConfirmation: true, persisted: false, stages }, { headers });
}
