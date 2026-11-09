import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireCurrentLegalAcceptance } from "@/lib/legal/require-current-acceptance";

const headers = { "Cache-Control": "no-store" };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function PATCH(request: Request, { params }: { params: Promise<{ journeyId: string; missionId: string }> }) {
  if (process.env.MYRYRA_JOURNEY_ENABLED !== "true") return NextResponse.json({ error: "Journey indisponível." }, { status: 404, headers });
  const { journeyId, missionId } = await params;
  if (!uuid.test(journeyId) || !uuid.test(missionId)) return NextResponse.json({ error: "Identificador inválido." }, { status: 400, headers });
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Autenticação necessária." }, { status: 401, headers });
  const consent = await requireCurrentLegalAcceptance(user.id);
  if (!consent.allowed) return NextResponse.json({ error: consent.reason }, { status: consent.reason === "ACCEPTANCE_REQUIRED" ? 403 : 503, headers });
  const { data: journey, error: journeyError } = await supabase.from("myryra_journeys").select("id,status").eq("id", journeyId).eq("owner_id", user.id).maybeSingle();
  if (journeyError) return NextResponse.json({ error: "Jornada indisponível." }, { status: 503, headers });
  if (!journey) return NextResponse.json({ error: "Jornada não encontrada." }, { status: 404, headers });
  if (journey.status !== "active") return NextResponse.json({ error: "Jornada não está ativa." }, { status: 409, headers });
  if ((request.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase() !== "application/json") return NextResponse.json({ error: "JSON obrigatório." }, { status: 415, headers });
  const length = request.headers.get("content-length");
  if (length !== null && (!Number.isSafeInteger(Number(length)) || Number(length) < 0)) return NextResponse.json({ error: "Tamanho inválido." }, { status: 400, headers });
  if (length !== null && Number(length) > 256) return NextResponse.json({ error: "Requisição muito grande." }, { status: 413, headers });
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
      if (bytes > 256) { await reader.cancel(); return NextResponse.json({ error: "Requisição muito grande." }, { status: 413, headers }); }
      raw += decoder.decode(part.value, { stream: true });
    }
    input = JSON.parse(raw + decoder.decode());
  } catch { return NextResponse.json({ error: "JSON inválido." }, { status: 400, headers }); }
  if (!input || typeof input !== "object" || Array.isArray(input) || !["pending", "completed"].includes((input as { status?: string }).status ?? "")) return NextResponse.json({ error: "Estado inválido." }, { status: 400, headers });
  const status = (input as { status: "pending" | "completed" }).status;
  const { data: existing, error: existingError } = await supabase.from("myryra_journey_missions").select("id,status,completed_at").eq("id", missionId).eq("journey_id", journeyId).maybeSingle();
  if (existingError) return NextResponse.json({ error: "Missão indisponível." }, { status: 503, headers });
  if (!existing) return NextResponse.json({ error: "Missão não encontrada." }, { status: 404, headers });
  if (existing.status === status) return NextResponse.json({ mission: existing, unchanged: true }, { headers });
  const { data, error } = await supabase.from("myryra_journey_missions").update({ status, completed_at: status === "completed" ? new Date().toISOString() : null })
    .eq("id", missionId).eq("journey_id", journeyId).eq("status", existing.status)
    .select("id,title,status,due_at,completed_at,created_at").maybeSingle();
  if (error) return NextResponse.json({ error: "Não foi possível atualizar a missão." }, { status: 503, headers });
  if (!data) return NextResponse.json({ error: "Missão alterada em outra sessão. Atualize e tente novamente." }, { status: 409, headers });
  return NextResponse.json({ mission: data }, { headers });
}
