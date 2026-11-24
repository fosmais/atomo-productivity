import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasCurrentOptionalConsent } from "@/lib/privacy/optional-consent";

export async function GET() {
  const client = await createClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return NextResponse.json({ allowed: false }, { status: 401 });
  const assurance = await client.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error || (assurance.data.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2"))
    return NextResponse.json({ allowed: false }, { status: 403 });
  const allowed = await hasCurrentOptionalConsent(data.user.id, "health_mika_sharing");
  return NextResponse.json({ allowed }, { status: allowed ? 200 : 403, headers: { "Cache-Control": "no-store" } });
}
