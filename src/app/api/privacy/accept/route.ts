import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const headers = { "Cache-Control": "private, no-store" };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Explicit acceptance of one currently published document version.
 * Never infer acceptance from sign-in, page views or a prechecked checkbox.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) return NextResponse.json({ error: "Autenticação necessária." }, { status: 401, headers });
  const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error) return NextResponse.json({ error: "Verificação de sessão indisponível." }, { status: 503, headers });
  if (assurance.data.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2") {
    return NextResponse.json({ error: "Segundo fator obrigatório.", code: "MFA_REQUIRED" }, { status: 403, headers });
  }
  if ((request.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase() !== "application/json") {
    return NextResponse.json({ error: "Envie JSON." }, { status: 415, headers });
  }
  let input: unknown;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > 2048) return NextResponse.json({ error: "Requisição muito grande." }, { status: 413, headers });
    input = JSON.parse(raw);
  } catch { return NextResponse.json({ error: "JSON inválido." }, { status: 400, headers }); }
  if (!input || typeof input !== "object" || Array.isArray(input)) return NextResponse.json({ error: "Dados inválidos." }, { status: 400, headers });
  const data = input as Record<string, unknown>;
  if (typeof data.documentVersionId !== "string" || !uuid.test(data.documentVersionId) ||
      typeof data.requestId !== "string" || !uuid.test(data.requestId) ||
      data.accepted !== true ||
      (data.evidenceSource !== "registration" && data.evidenceSource !== "google_onboarding" && data.evidenceSource !== "settings")) {
    return NextResponse.json({ error: "Aceite explícito, documento, origem e identificador são obrigatórios." }, { status: 422, headers });
  }
  const now = new Date().toISOString();
  const admin = createSupabaseAdmin();
  const { data: document, error: documentError } = await admin.from("myryra_privacy_document_versions")
    .select("id,document_type,version").eq("id", data.documentVersionId)
    .eq("status", "published").lte("published_at", now).lte("effective_at", now).maybeSingle();
  if (documentError) return NextResponse.json({ error: "Documento indisponível." }, { status: 503, headers });
  if (!document || !["terms", "privacy_notice"].includes(document.document_type)) {
    return NextResponse.json({ error: "Versão legal não vigente." }, { status: 409, headers });
  }
  // The client must show this exact version before submitting acceptance.
  const { data: existing, error: existingError } = await admin.from("myryra_privacy_acceptances")
    .select("document_version_id,action").eq("user_id", auth.user.id).eq("request_id", data.requestId).maybeSingle();
  if (existingError) return NextResponse.json({ error: "Não foi possível verificar o aceite." }, { status: 503, headers });
  if (existing) {
    if (existing.document_version_id !== document.id || existing.action !== "accepted") {
      return NextResponse.json({ error: "Identificador de requisição já utilizado." }, { status: 409, headers });
    }
    return NextResponse.json({ accepted: true, documentVersionId: document.id, alreadyRecorded: true }, { headers });
  }
  const { error: insertError } = await admin.from("myryra_privacy_acceptances").insert({
    user_id: auth.user.id, document_version_id: document.id, action: "accepted",
    evidence_source: data.evidenceSource, request_id: data.requestId, ui_locale: "pt-BR",
  });
  if (insertError) {
    // Unique request-id races must never be reported as a successful new acceptance.
    return NextResponse.json({ error: "Não foi possível registrar o aceite. Consulte o status antes de tentar novamente." }, { status: 409, headers });
  }
  return NextResponse.json({ accepted: true, documentVersionId: document.id, alreadyRecorded: false }, { status: 201, headers });
}
