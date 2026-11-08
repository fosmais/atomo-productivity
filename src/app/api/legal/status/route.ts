import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const now = new Date().toISOString();
  const { data: versions, error: versionsError } = await supabase
    .from("myryra_privacy_document_versions")
    .select("id,document_type,version,public_url,published_at")
    .in("document_type", ["terms", "privacy_notice"])
    .eq("status", "published")
    .lte("effective_at", now)
    .lte("published_at", now)
    .order("effective_at", { ascending: false });
  if (versionsError) return NextResponse.json({ error: "Documentos indisponíveis." }, { status: 503 });
  const terms = versions?.find(row => row.document_type === "terms" && row.published_at);
  const notice = versions?.find(row => row.document_type === "privacy_notice" && row.published_at);
  if (!terms || !notice) return NextResponse.json({ error: "Documentos não publicados.", code: "LEGAL_NOT_CONFIGURED" }, { status: 503 });
  // Only allow secure published document links to be presented for explicit acceptance.
  const validDocumentUrl = (value: unknown) => {
    if (typeof value !== "string") return false;
    try { return new URL(value).protocol === "https:"; } catch { return false; }
  };
  if (!validDocumentUrl(terms.public_url) || !validDocumentUrl(notice.public_url))
    return NextResponse.json({ error: "Links dos documentos legais indisponíveis.", code: "LEGAL_NOT_CONFIGURED" },
      { status: 503, headers: { "Cache-Control": "no-store" } });

  const { data: records, error: recordsError } = await supabase
    .from("myryra_privacy_acceptances")
    .select("document_version_id,action")
    .eq("user_id", user.id)
    .in("document_version_id", [terms.id, notice.id]);
  if (recordsError) return NextResponse.json({ error: "Consulta de aceite indisponível." }, { status: 503 });
  const termsAccepted = records?.some(row => row.document_version_id === terms.id && row.action === "accepted") === true;
  const noticeAcknowledged = records?.some(row => row.document_version_id === notice.id && row.action === "acknowledged") === true;
  return NextResponse.json({
    accepted: termsAccepted && noticeAcknowledged,
    documents: [
      { type: "terms", version: terms.version, url: terms.public_url, accepted: termsAccepted },
      { type: "privacy", version: notice.version, url: notice.public_url, accepted: noticeAcknowledged }
    ],
    requires_explicit_acceptance: !(termsAccepted && noticeAcknowledged)
  }, { headers: { "Cache-Control": "no-store" } });
}
