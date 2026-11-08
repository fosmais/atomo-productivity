import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// Only an explicit user click may invoke this route. Never backfill acceptance.
export async function POST(request: Request) {
  if (!(request.headers.get("content-type") || "").toLowerCase().startsWith("application/json"))
    return NextResponse.json({ error: "JSON obrigatório." }, { status: 415 });
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  try {
    if (!origin || !host || new URL(origin).protocol !== "https:" || new URL(origin).host !== host)
      return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  } catch {
    return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  let body: unknown;
  try {
    if (Number(request.headers.get("content-length") || "0") > 2048)
      return NextResponse.json({ error: "Requisição muito grande." }, { status: 413 });
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > 2048)
      return NextResponse.json({ error: "Requisição muito grande." }, { status: 413 });
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Confirmação inválida." }, { status: 400 });
  const input = body as Record<string, unknown>;
  if (input.accept_terms !== true || input.acknowledge_privacy !== true ||
      typeof input.terms_version !== "string" || typeof input.privacy_version !== "string")
    return NextResponse.json({ error: "Confirmação explícita obrigatória." }, { status: 400 });

  const now = new Date().toISOString();
  const { data: versions, error: versionError } = await supabase
    .from("myryra_privacy_document_versions")
    .select("id,document_type,version,published_at,public_url")
    .in("document_type", ["terms", "privacy_notice"])
    .eq("status", "published")
    .lte("effective_at", now)
    .lte("published_at", now)
    .order("effective_at", { ascending: false });
  if (versionError) return NextResponse.json({ error: "Documentos indisponíveis." }, { status: 503 });
  const terms = versions?.find(row => row.document_type === "terms" && row.published_at);
  const notice = versions?.find(row => row.document_type === "privacy_notice" && row.published_at);
  if (!terms || !notice || !terms.public_url || !notice.public_url)
    return NextResponse.json({ error: "Documentos não publicados.", code: "LEGAL_NOT_CONFIGURED" }, { status: 503 });
  if (input.terms_version !== terms.version || input.privacy_version !== notice.version)
    return NextResponse.json({ error: "Versão desatualizada. Releia os documentos atuais." }, { status: 409 });

  try {
    const admin = createSupabaseAdmin();
    // Repeated explicit submissions should not create duplicate evidence.
    // Only the authenticated user's current published versions are considered.
    const { data: existing, error: existingError } = await admin
      .from("myryra_privacy_acceptances")
      .select("document_version_id,action")
      .eq("user_id", user.id)
      .in("document_version_id", [terms.id, notice.id]);
    if (existingError) return NextResponse.json({ error: "Não foi possível verificar o aceite.", code: "LEGAL_CHECK_UNAVAILABLE" }, { status: 503 });
    const rows = [
      { user_id: user.id, document_version_id: terms.id, action: "accepted", evidence_source: "settings", request_id: crypto.randomUUID(), ui_locale: "pt-BR" },
      { user_id: user.id, document_version_id: notice.id, action: "acknowledged", evidence_source: "settings", request_id: crypto.randomUUID(), ui_locale: "pt-BR" }
    ].filter(row => !(existing ?? []).some(item =>
      item.document_version_id === row.document_version_id && item.action === row.action));
    if (rows.length) {
      const { error: insertError } = await admin.from("myryra_privacy_acceptances").insert(rows);
      if (insertError) return NextResponse.json({ error: "Não foi possível registrar o aceite.", code: "LEGAL_WRITE_FAILED" }, { status: 503 });
    }
  } catch {
    return NextResponse.json({ error: "Serviço de aceite indisponível." }, { status: 503 });
  }

  const { data: confirmed, error: verifyError } = await supabase
    .from("myryra_privacy_acceptances")
    .select("document_version_id,action")
    .eq("user_id", user.id)
    .in("document_version_id", [terms.id, notice.id]);
  if (verifyError || !confirmed?.some(row => row.document_version_id === terms.id && row.action === "accepted") ||
      !confirmed?.some(row => row.document_version_id === notice.id && row.action === "acknowledged"))
    return NextResponse.json({ error: "Não foi possível confirmar o aceite." }, { status: 503 });
  return NextResponse.json({ accepted: true }, { headers: { "Cache-Control": "no-store" } });
}
