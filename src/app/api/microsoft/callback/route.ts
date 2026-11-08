import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { encryptMicrosoftToken } from "@/lib/microsoft-token-crypto";

function equal(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
export async function GET(request: NextRequest) {
  const fail = NextResponse.redirect(new URL("/dashboard?microsoft=connection_failed", request.url));
  fail.cookies.delete({ name: "myryra_microsoft_oauth", path: "/api/microsoft" });
  if (process.env.MICROSOFT_INTEGRATION_ENABLED !== "true") return fail;
  const raw = request.cookies.get("myryra_microsoft_oauth")?.value;
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  if (!raw || !code || code.length > 2048 || !state) return fail;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return fail;
    const record = parsed as Record<string, unknown>;
    if (typeof record.state !== "string" || typeof record.verifier !== "string" || typeof record.userId !== "string" || !equal(record.state, state)) return fail;
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user || user.id !== record.userId) return fail;
    const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assurance.error || (assurance.data.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2")) return fail;
    const clientId = process.env.MICROSOFT_CLIENT_ID;
    const secret = process.env.MICROSOFT_CLIENT_SECRET;
    const redirectUri = process.env.MICROSOFT_REDIRECT_URI;
    if (!clientId || !secret || !redirectUri) return fail;
    const expected = new URL("/api/microsoft/callback", request.url);
    if (new URL(redirectUri).href !== expected.href) return fail;
    const body = new URLSearchParams({
      client_id: clientId, client_secret: secret, code, redirect_uri: redirectUri,
      grant_type: "authorization_code", code_verifier: record.verifier,
      scope: "openid offline_access Calendars.Read",
    });
    const exchange = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
      method: "POST", body, headers: { "Content-Type": "application/x-www-form-urlencoded" },
      cache: "no-store", signal: AbortSignal.timeout(10000),
    });
    if (!exchange.ok) return fail;
    const payload: unknown = await exchange.json();
    if (!payload || typeof payload !== "object") return fail;
    const token = payload as Record<string, unknown>;
    if (typeof token.access_token !== "string" || !token.access_token || typeof token.refresh_token !== "string" || !token.refresh_token) return fail;
    const expires = typeof token.expires_in === "number" ? Math.max(60, Math.min(token.expires_in, 86400)) : 3600;
    const admin = createSupabaseAdmin();
    const { error: saveError } = await admin.from("microsoft_connections").upsert({
      user_id: user.id,
      encrypted_access_token: encryptMicrosoftToken(token.access_token),
      encrypted_refresh_token: encryptMicrosoftToken(token.refresh_token),
      token_expires_at: new Date(Date.now() + expires * 1000).toISOString(),
      scope: "Calendars.Read",
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    if (saveError) return fail;
    const success = NextResponse.redirect(new URL("/dashboard?microsoft=connected", request.url));
    success.cookies.delete({ name: "myryra_microsoft_oauth", path: "/api/microsoft" });
    return success;
  } catch { return fail; }
}
