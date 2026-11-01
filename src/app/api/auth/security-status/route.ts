import { connection, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";



export async function GET() {
  await connection();
  const headers = { "Cache-Control": "private, no-store" };
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Autenticação necessária." }, { status: 401, headers });

  const [assurance, factors] = await Promise.all([
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    supabase.auth.mfa.listFactors(),
  ]);
  if (assurance.error || factors.error) {
    return NextResponse.json({ error: "Estado de segurança indisponível." }, { status: 503, headers });
  }
  const count = factors.data.totp.filter(factor => factor.status === "verified").length;
  return NextResponse.json({
    mfa: {
      enrolled: count > 0,
      verifiedFactors: count,
      challengeRequired: assurance.data.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2",
      sessionVerified: assurance.data.currentLevel === "aal2",
    },
  }, { headers });
}
