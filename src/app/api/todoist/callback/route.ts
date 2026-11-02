import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { encryptTodoistToken } from "@/lib/todoist-token-crypto";

export async function GET(request: NextRequest) {
  const redirect = new URL("/dashboard", request.url);
  redirect.searchParams.set("todoist", "connection_failed");
  const response = NextResponse.redirect(redirect);
  const cookie = request.cookies.get("myryra_todoist_oauth_state")?.value;
  response.cookies.delete({ name: "myryra_todoist_oauth_state", path: "/api/todoist" });
  const returned = request.nextUrl.searchParams.get("state");
  const code = request.nextUrl.searchParams.get("code");
  if (!cookie || !returned || !code || code.length > 2048) return response;
  try {
    const record: unknown = JSON.parse(cookie);
    if (!record || typeof record !== "object") return response;
    const { state, userId } = record as Record<string, unknown>;
    if (typeof state !== "string" || typeof userId !== "string") return response;
    const a = Buffer.from(returned);
    const b = Buffer.from(state);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return response;
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user || user.id !== userId) return response;
    const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assurance.error || (assurance.data.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2")) return response;
    const clientId = process.env.TODOIST_CLIENT_ID;
    const clientSecret = process.env.TODOIST_CLIENT_SECRET;
    if (!clientId || !clientSecret) return response;
    const exchange = await fetch("https://todoist.com/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!exchange.ok) return response;
    const payload: unknown = await exchange.json();
    if (!payload || typeof payload !== "object") return response;
    const token = (payload as Record<string, unknown>).access_token;
    if (typeof token !== "string" || !token || token.length > 4096) return response;
    const admin = createSupabaseAdmin();
    const { error: saveError } = await admin.from("todoist_connections").upsert({
      user_id: user.id,
      encrypted_access_token: encryptTodoistToken(token),
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    if (saveError) return response;
    const success = NextResponse.redirect(new URL("/dashboard?todoist=connected", request.url));
    success.cookies.delete({ name: "myryra_todoist_oauth_state", path: "/api/todoist" });
    return success;
  } catch {
    return response;
  }
}
