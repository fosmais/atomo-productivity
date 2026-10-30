import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  if (!code && !tokenHash) {
    return NextResponse.redirect(new URL("/login?error=recovery", url.origin));
  }

  const supabase = await createClient();
  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : await supabase.auth.verifyOtp({ token_hash: tokenHash!, type: "recovery" });

  if (error) {
    return NextResponse.redirect(new URL("/login?error=recovery", url.origin));
  }

  return NextResponse.redirect(new URL("/auth/reset-password", url.origin));
}
