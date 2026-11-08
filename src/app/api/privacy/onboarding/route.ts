import { NextResponse, connection } from "next/server";
import { createClient } from "@/lib/supabase/server";


export async function GET() {
  await connection();
  const client = await createClient();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError || !auth.user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { data: docs, error: docsError } = await client.from("myryra_privacy_document_versions")
    .select("id,document_type,version,public_url,effective_at,published_at")
    .in("document_type", ["terms", "privacy_notice"]).eq("status", "published")
    .lte("effective_at", new Date().toISOString())
    .order("effective_at", { ascending: false });
  if (docsError) return NextResponse.json({ error: "Documentos indisponíveis." }, { status: 503 });
  const terms = docs?.find(d => d.document_type === "terms" && d.published_at) ?? null;
  const notice = docs?.find(d => d.document_type === "privacy_notice" && d.published_at) ?? null;
  if (!terms || !notice) return NextResponse.json({ configured: false, terms, notice, accepted: false }, { headers: { "Cache-Control": "no-store" } });
  const { data: acceptances, error: historyError } = await client.from("myryra_privacy_acceptances")
    .select("document_version_id,action").in("document_version_id", [terms.id, notice.id]);
  if (historyError) return NextResponse.json({ error: "Histórico indisponível." }, { status: 503 });
  const accepted = !!acceptances?.some(a => a.document_version_id === terms.id && a.action === "accepted");
  const acknowledged = !!acceptances?.some(a => a.document_version_id === notice.id && a.action === "acknowledged");
  return NextResponse.json({ configured: true, terms, notice, accepted, acknowledged,
    complete: accepted && acknowledged }, { headers: { "Cache-Control": "no-store" } });
}
