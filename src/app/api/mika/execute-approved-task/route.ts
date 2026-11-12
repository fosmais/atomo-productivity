import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasCurrentLegalAcceptance } from "@/lib/privacy/legal-acceptance";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const headers = { "Cache-Control": "private, no-store" };

// Staging-only opt-in. The database RPC atomically checks ownership, approval,
// expiry, approved plan, and deduplicates concurrent requests via row locking.
export async function POST(request: Request) {
  if (process.env.MYRYRA_MIKA_INTERNAL_EXECUTION_ENABLED !== "true")
    return NextResponse.json({ error: "Execução interna indisponível." }, { status: 503, headers });
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json")
    return NextResponse.json({ error: "Envie JSON." }, { status: 415, headers });
  const declared = request.headers.get("content-length");
  if (declared && /^\d+$/.test(declared) && Number(declared) > 2048)
    return NextResponse.json({ error: "Requisição muito grande." }, { status: 413, headers });
  let body: unknown;
  try {
    const reader = request.body?.getReader();
    if (!reader) throw new Error("missing body");
    const decoder = new TextDecoder("utf-8", { fatal: true });
    let raw = "", bytes = 0;
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > 2048) {
          await reader.cancel();
          return NextResponse.json({ error: "Requisição muito grande." }, { status: 413, headers });
        }
        raw += decoder.decode(chunk.value, { stream: true });
      }
      raw += decoder.decode();
    } finally { reader.releaseLock(); }
    body = JSON.parse(raw);
  } catch { return NextResponse.json({ error: "JSON inválido." }, { status: 400, headers }); }
  if (!body || typeof body !== "object" || Array.isArray(body))
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400, headers });
  const fields = body as Record<string, unknown>;
  if (Object.keys(fields).some(key => !["proposalId", "planId"].includes(key)) ||
      typeof fields.proposalId !== "string" || !uuid.test(fields.proposalId) ||
      typeof fields.planId !== "string" || !uuid.test(fields.planId))
    return NextResponse.json({ error: "Identificadores inválidos." }, { status: 400, headers });

  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user)
    return NextResponse.json({ error: "Autenticação necessária." }, { status: 401, headers });
  const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error) return NextResponse.json({ error: "Sessão indisponível." }, { status: 503, headers });
  if (assurance.data.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2")
    return NextResponse.json({ error: "Segundo fator obrigatório.", code: "MFA_REQUIRED" }, { status: 403, headers });
  // Fail closed for execution, regardless of whether the UI rollout gate is enabled.
  if (!(await hasCurrentLegalAcceptance(auth.user.id)))
    return NextResponse.json({ error: "Aceite legal vigente obrigatório.", code: "LEGAL_ACCEPTANCE_REQUIRED" }, { status: 403, headers });

  const { data, error } = await supabase.rpc("mika_execute_approved_task", {
    p_proposal_id: fields.proposalId,
    p_plan_id: fields.planId,
  });
  if (error) {
    if (error.code === "P0002") return NextResponse.json({ error: "Proposta ou plano não encontrado." }, { status: 404, headers });
    if (error.code === "P0001" || error.code === "22023")
      return NextResponse.json({ error: "Proposta não autorizada ou incompatível." }, { status: 409, headers });
    return NextResponse.json({ error: "Execução indisponível." }, { status: 503, headers });
  }
  const result = Array.isArray(data) ? data[0] : null;
  if (!result || !["executed", "already_executed", "expired"].includes(result.execution_status))
    return NextResponse.json({ error: "Resposta de execução inválida." }, { status: 503, headers });
  return NextResponse.json({ status: result.execution_status, taskId: result.task_id ?? null }, { headers });
}
