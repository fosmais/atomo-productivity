import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Read-only legal acceptance status. Never infers acceptance from account age.
export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user)
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const terms = process.env.MYRYRA_TERMS_VERSION;
  const privacy = process.env.MYRYRA_PRIVACY_VERSION;
  if (!terms || !privacy)
    return NextResponse.json(
      { error: "Versões legais não publicadas.", code: "LEGAL_NOT_CONFIGURED" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );

  const { data, error } = await supabase
    .from("myryra_legal_acceptances")
    .select("document_type,document_version,accepted_at")
    .eq("user_id", user.id)
    .in("document_type", ["terms", "privacy"]);
  if (error)
    return NextResponse.json(
      { error: "Consulta de aceite indisponível.", code: "LEGAL_CHECK_UNAVAILABLE" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );

  const termsAccepted = (data ?? []).some(
    row => row.document_type === "terms" && row.document_version === terms
  );
  const privacyAccepted = (data ?? []).some(
    row => row.document_type === "privacy" && row.document_version === privacy
  );
  return NextResponse.json({
    accepted: termsAccepted && privacyAccepted,
    documents: [
      { type: "terms", version: terms, accepted: termsAccepted },
      { type: "privacy", version: privacy, accepted: privacyAccepted }
    ],
    requires_explicit_acceptance: !(termsAccepted && privacyAccepted)
  }, { headers: { "Cache-Control": "no-store" } });
}
