import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Approval only records a decision; execution remains disabled.
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error) return NextResponse.json({ error: "Sessão indisponível." }, { status: 503 });
  if (assurance.data.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2")
    return NextResponse.json({ error: "Segundo fator obrigatório." }, { status: 403 });
  if (!(request.headers.get("content-type") || "").toLowerCase().startsWith("application/json"))
    return NextResponse.json({ error: "JSON obrigatório." }, { status: 415 });
  const length = Number(request.headers.get("content-length") || "0");
  if (length > 1024) return NextResponse.json({ error: "Requisição muito grande." }, { status: 413 });
  let body: unknown;
  try {
    const raw = await request.text();
    if (raw.length > 1024) return NextResponse.json({ error: "Requisição muito grande." }, { status: 413 });
    body = JSON.parse(raw);
  } catch { return NextResponse.json({ error: "JSON inválido." }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body))
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  const { proposalId, approve } = body as Record<string, unknown>;
  if (typeof proposalId !== "string" || !uuid.test(proposalId) || typeof approve !== "boolean")
    return NextResponse.json({ error: "Decisão inválida." }, { status: 400 });
  const { data, error } = await supabase.rpc("mika_decide_proposal", {
    p_proposal_id: proposalId, p_approve: approve
  });
  if (error) {
    if (error.code === "P0002") return NextResponse.json({ error: "Proposta não encontrada." }, { status: 404 });
    if (error.code === "P0001") return NextResponse.json({ error: "Proposta já decidida." }, { status: 409 });
    return NextResponse.json({ error: "Não foi possível registrar a decisão." }, { status: 503 });
  }
  const status = data?.[0]?.decision_status;
  return NextResponse.json({ proposal_id: proposalId, status, executed: false },
    { headers: { "Cache-Control": "no-store" } });
}
