import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";


const allowedActions = new Set(["accepted", "acknowledged"]);
const allowedSources = new Set(["registration", "google_onboarding", "settings"]);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function sessionUser() {
  const client = await createClient();
  const { data, error } = await client.auth.getUser();
  return error ? null : data.user;
}

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createAdminClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function GET() {
  const user = await sessionUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const client = await createClient();
  const [acceptances, choices] = await Promise.all([
    client.from("myryra_privacy_acceptances").select("id,document_version_id,action,occurred_at,evidence_source").order("occurred_at", { ascending: false }).limit(100),
    client.from("myryra_privacy_choices").select("id,purpose_key,purpose_version,granted,occurred_at").order("occurred_at", { ascending: false }).limit(200),
  ]);
  if (acceptances.error || choices.error) return NextResponse.json({ error: "Histórico indisponível." }, { status: 503 });
  return NextResponse.json({ acceptances: acceptances.data, choices: choices.data }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const user = await sessionUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const service = admin();
  if (!service) return NextResponse.json({ error: "Serviço de privacidade não configurado." }, { status: 503 });
  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid");
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }
  const { requestId, documentVersionId, action, source } = body;
  if (typeof requestId !== "string" || !uuidPattern.test(requestId) ||
      typeof documentVersionId !== "string" || !uuidPattern.test(documentVersionId) ||
      typeof action !== "string" || !allowedActions.has(action) ||
      typeof source !== "string" || !allowedSources.has(source)) {
    return NextResponse.json({ error: "Dados de aceite inválidos." }, { status: 400 });
  }
  const { data: doc, error: docError } = await service.from("myryra_privacy_document_versions")
    .select("id,document_type,status,effective_at,published_at").eq("id", documentVersionId).maybeSingle();
  if (docError) return NextResponse.json({ error: "Documento indisponível." }, { status: 503 });
  if (!doc || doc.status !== "published" || !doc.published_at ||
      new Date(doc.effective_at).getTime() > Date.now() ||
      new Date(doc.published_at).getTime() > Date.now() ||
      !["terms", "privacy_notice"].includes(doc.document_type) ||
      (doc.document_type === "terms" && action !== "accepted") ||
      (doc.document_type !== "terms" && action !== "acknowledged")) {
    return NextResponse.json({ error: "Versão de documento inválida ou não publicada." }, { status: 409 });
  }
  // Only the currently effective version may be accepted. Prevent stale tabs from
  // recording an outdated version after a new document is published.
  const { data: currentDocs, error: currentError } = await service
    .from("myryra_privacy_document_versions")
    .select("id")
    .eq("document_type", doc.document_type)
    .eq("status", "published")
    .lte("effective_at", new Date().toISOString())
    .lte("published_at", new Date().toISOString())
    .order("effective_at", { ascending: false })
    .limit(1);
  if (currentError) return NextResponse.json({ error: "Não foi possível validar a versão vigente." }, { status: 503 });
  if (currentDocs?.[0]?.id !== documentVersionId) {
    return NextResponse.json({ error: "O documento foi atualizado. Recarregue a página para aceitar a versão vigente." }, { status: 409 });
  }
  const { data: existing, error: lookupError } = await service.from("myryra_privacy_acceptances")
    .select("id,document_version_id,action").eq("user_id", user.id).eq("request_id", requestId).maybeSingle();
  if (lookupError) return NextResponse.json({ error: "Falha ao verificar solicitação." }, { status: 503 });
  if (existing) {
    if (existing.document_version_id !== documentVersionId || existing.action !== action)
      return NextResponse.json({ error: "Identificador já utilizado." }, { status: 409 });
    return NextResponse.json({ id: existing.id, alreadyRecorded: true });
  }
  const { data, error } = await service.from("myryra_privacy_acceptances")
    .insert({ user_id: user.id, document_version_id: documentVersionId, action,
      evidence_source: source, request_id: requestId, ui_locale: "pt-BR" }).select("id").single();
  if (error) return NextResponse.json({ error: "Não foi possível registrar o aceite." }, { status: 503 });
  return NextResponse.json({ id: data.id, alreadyRecorded: false }, { status: 201 });
}
