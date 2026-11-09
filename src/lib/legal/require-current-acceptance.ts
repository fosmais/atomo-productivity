import "server-only";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

type Result =
  | { allowed: true; reason: "DISABLED" | "NO_PUBLISHED_DOCUMENTS" | "ACCEPTED" }
  | { allowed: false; reason: "ACCEPTANCE_REQUIRED" | "VERIFICATION_UNAVAILABLE" };

/**
 * Central consent check for authenticated server routes.
 * The caller must independently authenticate the user and pass its verified ID.
 * Fail closed on database errors; do not activate before publishing both documents.
 */
export async function requireCurrentLegalAcceptance(userId: string): Promise<Result> {
  if (process.env.MYRYRA_LEGAL_CONSENT_GATE_ENABLED !== "true") {
    return { allowed: true, reason: "DISABLED" };
  }
  try {
    const admin = createSupabaseAdmin();
    const { data: documents, error } = await admin
      .from("myryra_privacy_document_versions")
      .select("id,document_type")
      .eq("status", "published")
      .not("published_at", "is", null)
      .lte("effective_at", new Date().toISOString())
      .order("effective_at", { ascending: false });
    if (error || !documents) return { allowed: false, reason: "VERIFICATION_UNAVAILABLE" };
    const latest = new Map<string, string>();
    for (const document of documents) {
      if (!latest.has(document.document_type)) latest.set(document.document_type, document.id);
    }
    const terms = latest.get("terms");
    const privacy = latest.get("privacy_notice");
    if (!terms || !privacy) return { allowed: true, reason: "NO_PUBLISHED_DOCUMENTS" };
    const { data: rows, error: acceptanceError } = await admin
      .from("myryra_privacy_acceptances")
      .select("document_version_id")
      .eq("user_id", userId)
      .eq("action", "accepted")
      .in("document_version_id", [terms, privacy]);
    if (acceptanceError || !rows) return { allowed: false, reason: "VERIFICATION_UNAVAILABLE" };
    const accepted = new Set(rows.map((row) => row.document_version_id));
    return accepted.has(terms) && accepted.has(privacy)
      ? { allowed: true, reason: "ACCEPTED" }
      : { allowed: false, reason: "ACCEPTANCE_REQUIRED" };
  } catch {
    return { allowed: false, reason: "VERIFICATION_UNAVAILABLE" };
  }
}
