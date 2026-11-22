import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * Server-side prerequisite for new MYRYRA mutations. Never substitute this
 * read check for transaction-level authorization of a specific MIKA action.
 * Fail closed on missing documents, missing acceptance, or query errors.
 */
export async function hasCurrentLegalAcceptance(userId: string): Promise<boolean> {
  if (!userId) return false;
  try {
    const supabase = await createClient();
    const now = new Date().toISOString();
    const { data: versions, error: versionError } = await supabase
      .from("myryra_privacy_document_versions")
      .select("id,document_type")
      .eq("status", "published")
      .lte("published_at", now)
      .lte("effective_at", now)
      .order("effective_at", { ascending: false })
      .order("published_at", { ascending: false })
      .order("id", { ascending: false });
    if (versionError) return false;
    const ids = ["terms", "privacy_notice"].map((type) =>
      (versions ?? []).find((version) => version.document_type === type)?.id,
    );
    if (ids.some((id) => !id)) return false;
    const { data: accepted, error: acceptanceError } = await supabase
      .from("myryra_privacy_acceptances")
      .select("document_version_id")
      .eq("user_id", userId)
      .eq("action", "accepted")
      .in("document_version_id", ids as string[]);
    if (acceptanceError) return false;
    const acceptedIds = new Set((accepted ?? []).map((entry) => entry.document_version_id));
    return ids.every((id) => acceptedIds.has(id));
  } catch {
    return false;
  }
}
