import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const headers = { "Cache-Control": "no-store" };
const requiredTypes = ["terms", "privacy_notice"] as const;

/** Records explicit acceptance of the two current legal document versions. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Autenticação necessária." }, { status: 401, headers });

  let payload: unknown;
  try { payload = await request.json(); } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400, headers });
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400, headers });
  }
  const body = payload as Record<string, unknown>;
  if (body.accepted !== true || !body.versions || typeof body.versions !== "object" || Array.isArray(body.versions)) {
    return NextResponse.json({ error: "Confirmação explícita obrigatória." }, { status: 400, headers });
  }
  const versions = body.versions as Record<string, unknown>;
  if (requiredTypes.some((type) => typeof versions[type] !== "string" || !versions[type])) {
    return NextResponse.json({ error: "Versões dos documentos obrigatórias." }, { status: 400, headers });
  }
  try {
    const admin = createSupabaseAdmin();
    const { data: docs, error } = await admin.from("myryra_privacy_document_versions")
      .select("id,document_type,version").eq("status", "published")
      .lte("effective_at", new Date().toISOString())
      .not("published_at", "is", null)
      .order("effective_at", { ascending: false });
    if (error || !docs) throw new Error("Documentos indisponíveis");
    const current = new Map<string, (typeof docs)[number]>();
    for (const doc of docs) if (!current.has(doc.document_type)) current.set(doc.document_type, doc);
    if (requiredTypes.some((type) => !current.has(type) || current.get(type)!.version !== versions[type])) {
      return NextResponse.json({ error: "Os documentos foram atualizados. Revise as versões vigentes." }, { status: 409, headers });
    }
    const { data: existing, error: existingError } = await admin.from("myryra_privacy_acceptances")
      .select("document_version_id").eq("user_id", user.id).eq("action", "accepted")
      .in("document_version_id", requiredTypes.map((type) => current.get(type)!.id));
    if (existingError) throw new Error("Aceites indisponíveis");
    const accepted = new Set((existing ?? []).map((item) => item.document_version_id));
    const missing = requiredTypes.map((type) => current.get(type)!).filter((doc) => !accepted.has(doc.id));
    if (missing.length) {
      const requestId = randomUUID();
      const { error: insertError } = await admin.from("myryra_privacy_acceptances").insert(missing.map((doc) => ({
        user_id: user.id, document_version_id: doc.id, action: "accepted",
        evidence_source: "web_explicit_acceptance", request_id: requestId, ui_locale: "pt-BR",
      })));
      if (insertError) throw new Error("Falha ao registrar aceite");
    }
    return NextResponse.json({ accepted: true, versions: Object.fromEntries(requiredTypes.map((type) => [type, current.get(type)!.version])) }, { headers });
  } catch {
    return NextResponse.json({ error: "Não foi possível registrar o aceite." }, { status: 503, headers });
  }
}
