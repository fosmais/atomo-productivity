import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const headers = { "Cache-Control": "no-store" };

/** Read-only consent status. Never creates or assumes an acceptance. */
export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Autenticação necessária." }, { status: 401, headers });
  }
  try {
    const admin = createSupabaseAdmin();
    const { data: docs, error } = await admin.from("myryra_privacy_document_versions")
      .select("id,document_type,version,public_url,effective_at")
      .eq("status", "published")
      .lte("effective_at", new Date().toISOString())
      .order("effective_at", { ascending: false });
    if (error || !docs) throw new Error("Documentos indisponíveis");
    const current = new Map<string, (typeof docs)[number]>();
    for (const doc of docs) {
      if (!current.has(doc.document_type)) current.set(doc.document_type, doc);
    }
    const required = ["terms", "privacy_notice"];
    if (required.some((type) => !current.has(type))) {
      return NextResponse.json({
        ready: false, acceptanceRequired: true, reason: "LEGAL_DOCUMENTS_UNAVAILABLE",
        documents: [],
      }, { status: 503, headers });
    }
    const versions = required.map((type) => current.get(type)!);
    const { data: acceptances, error: acceptanceError } = await admin
      .from("myryra_privacy_acceptances").select("document_version_id")
      .eq("user_id", user.id).eq("action", "accepted")
      .in("document_version_id", versions.map((doc) => doc.id));
    if (acceptanceError) throw new Error("Aceites indisponíveis");
    const accepted = new Set((acceptances ?? []).map((item) => item.document_version_id));
    const documents = versions.map((doc) => ({
      type: doc.document_type, version: doc.version, url: doc.public_url,
      accepted: accepted.has(doc.id),
    }));
    return NextResponse.json({
      ready: true, acceptanceRequired: documents.some((doc) => !doc.accepted),
      documents,
    }, { headers });
  } catch {
    return NextResponse.json({
      ready: false, acceptanceRequired: true, error: "Verificação de aceite indisponível.",
    }, { status: 503, headers });
  }
}
