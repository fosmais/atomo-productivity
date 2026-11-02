import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** OAuth callback accepts only a fixed same-origin post-login destination. */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (!code || code.length > 2048) {
    return NextResponse.redirect(new URL("/login?error=oauth", url.origin));
  }

  const supabase = await createClient();
  try {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error("Invalid session");
    const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assurance.error) throw assurance.error;
    // The login page resumes MFA if a verified factor requires aal2.
    const destination = assurance.data.nextLevel === "aal2" &&
      assurance.data.currentLevel !== "aal2" ? "/login?mfa=required" : "/dashboard";
    return NextResponse.redirect(new URL(destination, url.origin));
  } catch {
    return NextResponse.redirect(new URL("/login?error=oauth", url.origin));
  }
}
