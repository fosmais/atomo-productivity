import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireCurrentLegalAcceptance } from "@/lib/legal/require-current-acceptance";

const headers = { "Cache-Control": "no-store" };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request, { params }: { params: Promise<{ journeyId: string }> }) {
  if (process.env.MYRYRA_JOURNEY_ENABLED !== "true") return NextResponse.json({ error: "Journey indisponível." }, { status: 404, headers });
  const { journeyId } = await params;
  if (!uuid.test(journeyId)) return NextResponse.json({ error: "Jornada inválida." }, { status: 400, headers });
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
  if (length !== null && Number(length) > 8192) return NextResponse.json({ error: "Requisição muito grande." }, { status: 413, headers });
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
      if (size > 8192) { await reader.cancel(); return NextResponse.json({ error: "Requisição muito grande." }, { status: 413, headers }); }
      raw += decoder.decode(part.value, { stream: true });
    }
    payload = JSON.parse(raw + decoder.decode());
  } catch { return NextResponse.json({ error: "JSON inválido." }, { status: 400, headers }); }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return NextResponse.json({ error: "Dados inválidos." }, { status: 400, headers });
  const titles = (payload as { titles?: unknown }).titles;
  if (!Array.isArray(titles) || titles.length < 1 || titles.length > 30 || !titles.every(title => typeof title === "string" && title.trim().length > 0 && title.trim().length <= 160)) return NextResponse.json({ error: "Lista de missões inválida." }, { status: 400, headers });
  const rows = (titles as string[]).map(title => ({ journey_id: journeyId, title: title.trim(), status: "pending" }));
  // PostgREST executes the multi-row INSERT as one database statement: all rows or none.
  const { data, error } = await supabase.from("myryra_journey_missions").insert(rows).select("id,title,status,created_at");
  if (error) return NextResponse.json({ error: "Não foi possível adicionar as missões." }, { status: 503, headers });
  return NextResponse.json({ missions: data ?? [], count: data?.length ?? 0 }, { status: 201, headers });
}
