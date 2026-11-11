import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { hasCurrentLegalAcceptance } from "@/lib/privacy/legal-acceptance";
import { checkConciergeRateLimit } from "@/lib/rate-limit";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const services = new Set(["transport", "restaurant", "parking", "hotel", "external_app", "other"]);
const noStore = { "Cache-Control": "private, no-store" };

// Enforce the byte limit while streaming; request.text() would buffer unbounded input.
async function readBoundedJson(request: Request): Promise<unknown> {
  const declared = request.headers.get("content-length");
  if (declared && /^\d+$/.test(declared) && Number(declared) > 8192)
    throw new Error("PAYLOAD_TOO_LARGE");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("INVALID_JSON");
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let raw = "";
  let bytes = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 8192) {
        await reader.cancel();
        throw new Error("PAYLOAD_TOO_LARGE");
      }
      raw += decoder.decode(chunk.value, { stream: true });
    }
    raw += decoder.decode();
    return JSON.parse(raw);
  } finally {
    reader.releaseLock();
  }
}

async function authenticate() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { user: null, status: 401 };
  const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error || (assurance.data.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2"))
    return { user: null, status: 403 };
  return { user, status: 200 };
}

export async function GET(request: Request) {
  const { user, status } = await authenticate();
  if (!user) return NextResponse.json({ error: "Acesso não autorizado." }, { status });
  const actionType = new URL(request.url).searchParams.get("actionType");
  if (actionType !== null && actionType !== "concierge_planning")
    return NextResponse.json({ error: "Filtro inválido." }, { status: 400 });
  let query = createSupabaseAdmin().from("mika_agent_actions")
    .select("id,event_id,service,action_type,status,provider,proposal,authorization_at,execution_started_at,execution_finished_at,provider_reference,result,error_code,created_at,updated_at")
    .eq("user_id", user.id);
  if (actionType) query = query.eq("action_type", actionType);
  const { data, error } = await query.order("created_at", { ascending: false }).limit(actionType ? 500 : 50);
  if (error) return NextResponse.json({ error: "Histórico indisponível." }, { status: 503 });
  return NextResponse.json({ actions: data ?? [] }, { headers: noStore });
}

// A proposal never invokes an external provider. Execution requires a separate server-side integration.
export async function POST(request: Request) {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json")
    return NextResponse.json({ error: "Envie JSON." }, { status: 415 });
  let body: unknown;
  try { body = await readBoundedJson(request); }
  catch (error) {
    if (error instanceof Error && error.message === "PAYLOAD_TOO_LARGE")
      return NextResponse.json({ error: "Solicitação muito grande." }, { status: 413, headers: noStore });
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  const { eventId, service, actionType, provider, proposal } = body as Record<string, unknown>;
  if (eventId !== undefined && (typeof eventId !== "string" || !uuid.test(eventId)) ||
      typeof service !== "string" || !services.has(service) ||
      typeof actionType !== "string" || !/^[a-z][a-z0-9_]{2,63}$/.test(actionType) ||
      provider !== undefined && (typeof provider !== "string" || provider.length > 100) ||
      !proposal || typeof proposal !== "object" || Array.isArray(proposal) ||
      JSON.stringify(proposal).length > 4000)
    return NextResponse.json({ error: "Proposta inválida." }, { status: 400 });
  const { user, status } = await authenticate();
  if (!user) return NextResponse.json({ error: "Acesso não autorizado." }, { status });
  if (process.env.MYRYRA_LEGAL_ACCEPTANCE_GATE_ENABLED === "true" &&
      !(await hasCurrentLegalAcceptance(user.id))) {
    return NextResponse.json(
      { error: "Aceite dos documentos legais vigentes necessário.", code: "LEGAL_ACCEPTANCE_REQUIRED" },
      { status: 403, headers: noStore },
    );
  }

  // Limit proposal creation to prevent unbounded persisted action records.
  let limit: Awaited<ReturnType<typeof checkConciergeRateLimit>>;
  try { limit = await checkConciergeRateLimit(user.id); }
  catch { return NextResponse.json({ error: "Serviço temporariamente indisponível." }, { status: 503, headers: noStore }); }
  if (!limit.allowed)
    return NextResponse.json(
      { error: "Limite de propostas atingido. Tente novamente mais tarde." },
      { status: 429, headers: { ...noStore, "Retry-After": String(Math.max(1, Math.ceil((limit.reset - Date.now()) / 1000))) } },
    );

  // The event must belong to the same user. Never trust a client-supplied owner.
  if (eventId) {
    const admin = createSupabaseAdmin();
    const { data, error } = await admin.from("events").select("id").eq("id", eventId).eq("user_id", user.id).maybeSingle();
    if (error || !data) return NextResponse.json({ error: "Compromisso não encontrado." }, { status: 404 });
  }
  const { data, error } = await createSupabaseAdmin().from("mika_agent_actions")
    .insert({ user_id: user.id, event_id: eventId ?? null, service, action_type: actionType, provider: provider ?? null, proposal, status: "awaiting_authorization" })
    .select("id,status,created_at").single();
  if (error?.code === "23505") return NextResponse.json({ error: "Já existe um planejamento ativo para este compromisso. Atualize a Agenda para consultar a autorização.", code: "ACTIVE_PROPOSAL_EXISTS" }, { status: 409, headers: noStore });
  if (error) return NextResponse.json({ error: "Não foi possível registrar a proposta." }, { status: 503 });
  return NextResponse.json({ action: data }, { status: 201, headers: noStore });
}

export async function PATCH(request: Request) {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json")
    return NextResponse.json({ error: "Envie JSON." }, { status: 415 });
  let body: unknown;
  try { body = await readBoundedJson(request); }
  catch (error) {
    if (error instanceof Error && error.message === "PAYLOAD_TOO_LARGE")
      return NextResponse.json({ error: "Solicitação muito grande." }, { status: 413, headers: noStore });
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  // Reject unexpected fields so clients cannot smuggle execution flags or approval scopes.
  if (Object.keys(body).some(key => !["actionId", "decision"].includes(key)))
    return NextResponse.json({ error: "Campos não permitidos na decisão." }, { status: 400, headers: noStore });
  const { actionId, decision } = body as Record<string, unknown>;
  if (typeof actionId !== "string" || !uuid.test(actionId) || (decision !== "authorize" && decision !== "cancel"))
    return NextResponse.json({ error: "Decisão inválida." }, { status: 400 });
  const { user, status } = await authenticate();
  if (!user) return NextResponse.json({ error: "Acesso não autorizado." }, { status });
  // Revoking a pending action must remain possible without legal acceptance.
  if (decision === "authorize") {
    if (process.env.MYRYRA_LEGAL_ACCEPTANCE_GATE_ENABLED === "true" &&
        !(await hasCurrentLegalAcceptance(user.id))) {
      return NextResponse.json(
        { error: "Aceite dos documentos legais vigentes necessário.", code: "LEGAL_ACCEPTANCE_REQUIRED" },
        { status: 403, headers: noStore },
      );
    }
  }

  const admin = createSupabaseAdmin();
  const now = new Date().toISOString();
  const nextStatus = decision === "authorize" ? "authorized" : "cancelled";
  const { data, error } = await admin.from("mika_agent_actions")
    .update({ status: nextStatus, ...(decision === "authorize" ? { authorization_at: now, authorization_scope: { approved: true } } : {}), updated_at: now })
    .eq("id", actionId).eq("user_id", user.id).eq("status", "awaiting_authorization")
    .select("id,status,authorization_at").maybeSingle();
  if (error) return NextResponse.json({ error: "Não foi possível registrar a decisão." }, { status: 503 });
  if (!data) return NextResponse.json({ error: "Ação inexistente ou já decidida." }, { status: 409 });
  // Authorization is recorded, but no booking, payment, or external app is invoked here.
  return NextResponse.json({ action: data, executed: false }, { headers: noStore });
}
