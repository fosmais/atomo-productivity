import { connection, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Read-only readiness for the authenticated user's mandatory legal documents.
 * Fail closed: missing/unpublished versions or missing acceptance never grant access.
 * This endpoint does not record consent and must not be treated as an execution gate
 * without enforcing the same policy inside the mutation transaction.
 */
export async function GET() {
  await connection();
  const headers = { "Cache-Control": "private, no-store" };
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) {
    return NextResponse.json({ error: "Autenticação necessária." }, { status: 401, headers });
  }

  const now = new Date().toISOString();
  const { data: versions, error: versionsError } = await supabase
    .from("myryra_privacy_document_versions")
    .select("id, document_type, version, public_url, effective_at, published_at")
    .eq("status", "published")
    .lte("effective_at", now)
    .lte("published_at", now)
    .order("effective_at", { ascending: false })
      .order("published_at", { ascending: false })
      .order("id", { ascending: false });
  if (versionsError) {
    return NextResponse.json({ error: "Documentos legais indisponíveis." }, { status: 503, headers });
  }

  const types = ["terms", "privacy_notice"] as const;
  const current = types.map((type) => ({
    type,
    document: (versions ?? []).find((version) => version.document_type === type) ?? null,
  }));
  const ids = current.map(({ document }) => document?.id).filter((id): id is string => typeof id === "string");
  const { data: acceptances, error: acceptancesError } = ids.length
    ? await supabase.from("myryra_privacy_acceptances")
        .select("document_version_id, action")
        .eq("user_id", auth.user.id)
        .eq("action", "accepted")
        .in("document_version_id", ids)
    : { data: [], error: null };
  if (acceptancesError) {
    return NextResponse.json({ error: "Aceites indisponíveis." }, { status: 503, headers });
  }

  const acceptedIds = new Set((acceptances ?? []).map((entry) => entry.document_version_id));
  const documents = current.map(({ type, document }) => ({
    type,
    version: document?.version ?? null,
    documentVersionId: document?.id ?? null,
    publicUrl: document?.public_url ?? null,
    published: Boolean(document && typeof document.public_url === "string" && /^https:\/\//i.test(document.public_url)),
    accepted: Boolean(document && acceptedIds.has(document.id)),
  }));
  return NextResponse.json({
    ready: documents.every((document) => document.published && document.accepted),
    documents,
    agentExecutionEnabled: false,
  }, { headers });
}
