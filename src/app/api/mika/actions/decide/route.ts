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
  // Verify the current published legal versions at decision time, not only at proposal time.
  const now = new Date().toISOString();
  const { data: docs, error: docsError } = await supabase
    .from("myryra_privacy_document_versions")
    .select("id,document_type,published_at")
    .in("document_type", ["terms", "privacy_notice"])
    .eq("status", "published")
    .lte("effective_at", now)
    .lte("published_at", now)
    .order("effective_at", { ascending: false });
  if (docsError) return NextResponse.json({ error: "Verificação legal indisponível." }, { status: 503 });
  const terms = docs?.find(doc => doc.document_type === "terms" && doc.published_at);
  const notice = docs?.find(doc => doc.document_type === "privacy_notice" && doc.published_at);
  if (!terms || !notice)
    return NextResponse.json({ error: "Documentos legais ainda não publicados.", code: "LEGAL_NOT_CONFIGURED" }, { status: 503 });
  const { data: acceptance, error: acceptanceError } = await supabase
    .from("myryra_privacy_acceptances")
    .select("document_version_id,action")
    .eq("user_id", user.id)
    .in("document_version_id", [terms.id, notice.id]);
  if (acceptanceError) return NextResponse.json({ error: "Verificação legal indisponível." }, { status: 503 });
  if (!acceptance?.some(row => row.document_version_id === terms.id && row.action === "accepted") ||
      !acceptance?.some(row => row.document_version_id === notice.id && row.action === "acknowledged"))
    return NextResponse.json({ error: "Aceite dos documentos vigentes necessário.", code: "LEGAL_ACCEPTANCE_REQUIRED" }, { status: 403 });
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
