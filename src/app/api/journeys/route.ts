import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireCurrentLegalAcceptance } from "@/lib/legal/require-current-acceptance";

const headers = { "Cache-Control": "no-store" };
const enabled = () => process.env.MYRYRA_JOURNEY_ENABLED === "true";

async function authenticated() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  return { supabase, user: error ? null : user };
}

/** Lists only the signed-in user's journeys, enforced again by Supabase RLS. */
export async function GET() {
  if (!enabled()) return NextResponse.json({ error: "Journey indisponível." }, { status: 404, headers });
  const { supabase, user } = await authenticated();
  if (!user) return NextResponse.json({ error: "Autenticação necessária." }, { status: 401, headers });
  const consent = await requireCurrentLegalAcceptance(user.id);
  if (!consent.allowed) return NextResponse.json({ error: consent.reason }, { status: consent.reason === "ACCEPTANCE_REQUIRED" ? 403 : 503, headers });
  const { data, error } = await supabase.from("myryra_journeys")
    .select("id,title,description,status,visibility,target_date,created_at,updated_at")
    .eq("owner_id", user.id).order("created_at", { ascending: false }).limit(50);
  if (error) return NextResponse.json({ error: "Não foi possível consultar jornadas." }, { status: 503, headers });
  return NextResponse.json({ journeys: data ?? [] }, { headers });
}

/** Creates a private personal journey; AI-generated plans require user confirmation elsewhere. */
export async function POST(request: Request) {
  if (!enabled()) return NextResponse.json({ error: "Journey indisponível." }, { status: 404, headers });
  const { supabase, user } = await authenticated();
  if (!user) return NextResponse.json({ error: "Autenticação necessária." }, { status: 401, headers });
  const consent = await requireCurrentLegalAcceptance(user.id);
  if (!consent.allowed) return NextResponse.json({ error: consent.reason }, { status: consent.reason === "ACCEPTANCE_REQUIRED" ? 403 : 503, headers });
  const mediaType = (request.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (mediaType !== "application/json") return NextResponse.json({ error: "JSON obrigatório." }, { status: 415, headers });
  const declared = request.headers.get("content-length");
  if (declared !== null && (!Number.isSafeInteger(Number(declared)) || Number(declared) < 0)) {
    return NextResponse.json({ error: "Tamanho inválido." }, { status: 400, headers });
  }
  if (declared !== null && Number(declared) > 8192) return NextResponse.json({ error: "Requisição muito grande." }, { status: 413, headers });
  let body: unknown;
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
      if (bytes > 8192) {
        await reader.cancel();
        return NextResponse.json({ error: "Requisição muito grande." }, { status: 413, headers });
      }
      raw += decoder.decode(part.value, { stream: true });
    }
    body = JSON.parse(raw + decoder.decode());
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400, headers });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Dados inválidos." }, { status: 400, headers });
  const input = body as Record<string, unknown>;
  if (typeof input.title !== "string" || !input.title.trim() || input.title.trim().length > 120 ||
      (input.description !== undefined && (typeof input.description !== "string" || input.description.length > 2000)) ||
      (input.target_date !== undefined && input.target_date !== null &&
       (typeof input.target_date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(input.target_date) ||
        Number.isNaN(Date.parse(input.target_date)) || new Date(input.target_date).toISOString().slice(0, 10) !== input.target_date))) {
    return NextResponse.json({ error: "Título, descrição ou data inválidos." }, { status: 400, headers });
  }
  if (input.missions !== undefined) {
    if (!Array.isArray(input.missions) || input.missions.length < 1 || input.missions.length > 30 ||
        !input.missions.every(title => typeof title === "string" && title.trim().length > 0 && title.trim().length <= 160)) {
      return NextResponse.json({ error: "Missões inválidas." }, { status: 400, headers });
    }
    const { data: journeyId, error: createError } = await supabase.rpc("myryra_create_journey_with_missions", {
      p_title: input.title.trim(),
      p_description: typeof input.description === "string" ? input.description.trim() : null,
      p_target_date: typeof input.target_date === "string" ? input.target_date : null,
      p_missions: (input.missions as string[]).map(title => title.trim()),
    });
    if (createError || !journeyId) return NextResponse.json({ error: "Não foi possível salvar a jornada e suas missões." }, { status: 503, headers });
    const { data: journey, error: lookupError } = await supabase.from("myryra_journeys")
      .select("id,title,description,status,visibility,target_date,created_at").eq("id", journeyId).eq("owner_id", user.id).single();
    if (lookupError || !journey) return NextResponse.json({ error: "Jornada salva, mas consulta indisponível." }, { status: 503, headers });
    return NextResponse.json({ journey }, { status: 201, headers });
  }
  const { data, error } = await supabase.from("myryra_journeys").insert({
    owner_id: user.id, title: input.title.trim(),
    description: typeof input.description === "string" ? input.description.trim() : null,
    target_date: typeof input.target_date === "string" ? input.target_date : null,
    status: "active", visibility: "private",
  }).select("id,title,description,status,visibility,target_date,created_at").single();
  if (error) return NextResponse.json({ error: "Não foi possível criar a jornada." }, { status: 503, headers });
  return NextResponse.json({ journey: data }, { status: 201, headers });
}
