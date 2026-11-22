import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

/** OAuth callback accepts only a fixed same-origin post-login destination. */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") === "/suporte-admin" ? "/suporte-admin" : "/dashboard";
  if (!code || code.length > 2048) {
    return NextResponse.redirect(new URL("/login?error=oauth", url.origin));
  }

  const response = NextResponse.redirect(new URL(next, url.origin));
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (items) => items.forEach(({ name, value, options }) => {
        request.cookies.set(name, value);
        response.cookies.set(name, value, options);
      }),
    },
  });
  let stage = "exchange";
  try {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("[auth/oauth-callback] exchange failed", { code: error.code, status: error.status });
      throw error;
    }
    if (!data.session || !data.user) throw new Error("OAuth exchange returned no session");
    // The exchange already validates the code and returns the authenticated user.
    // Avoid an additional getUser() request before the redirect, which can
    // fail on a stale request cookie and discard an otherwise valid login.
    stage = "mfa";
    let destination = next;
    try {
      const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (!assurance.error && assurance.data.nextLevel === "aal2" &&
          assurance.data.currentLevel !== "aal2") {
        destination = `/login?mfa=required${next === "/suporte-admin" ? "&next=%2Fsuporte-admin" : ""}`;
      } else if (assurance.error) {
        console.warn("[auth/oauth-callback] MFA assurance unavailable", { code: assurance.error.code });
      }
    } catch {
      console.warn("[auth/oauth-callback] MFA assurance request failed");
    }
    response.headers.set("Location", new URL(destination, url.origin).toString());
    return response;
  } catch (error) {
    console.error("[auth/oauth-callback] login failed", {
      stage,
      code: error && typeof error === "object" && "code" in error ? String(error.code) : "unknown",
    });
    return NextResponse.redirect(new URL("/login?error=oauth", url.origin));
  }
}
