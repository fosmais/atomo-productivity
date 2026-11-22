import { NextResponse, connection } from "next/server";
import { randomBytes } from "node:crypto";
import { createClient } from "@/lib/supabase/server";

/** Initiates Todoist OAuth with a short-lived, account-bound CSRF state. */
export async function GET(request: Request) {
  await connection();
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Faça login antes de conectar o Todoist." }, { status: 401 });
  const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error) return NextResponse.json({ error: "Verificação de sessão indisponível." }, { status: 503 });
  if (assurance.data.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2")
    return NextResponse.json({ error: "Segundo fator obrigatório.", code: "MFA_REQUIRED" }, { status: 403 });

  const clientId = process.env.TODOIST_CLIENT_ID;
  const redirectUri = process.env.TODOIST_OAUTH_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return NextResponse.json({ error: "Integração Todoist ainda não configurada pelo administrador." }, { status: 503 });
  }
  const expected = new URL("/api/todoist/callback", request.url);
  const callback = new URL(redirectUri);
  if (callback.protocol !== "https:" || callback.pathname !== expected.pathname) {
    return NextResponse.json({ error: "Callback Todoist não configurado corretamente." }, { status: 503 });
  }
  const state = randomBytes(32).toString("hex");
  const url = new URL("https://todoist.com/oauth/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("scope", "data:read");
  url.searchParams.set("state", state);
  const response = NextResponse.redirect(url);
  response.cookies.set("myryra_todoist_oauth_state", JSON.stringify({ state, userId: user.id }), {
    httpOnly: true, secure: true, sameSite: "lax", path: "/api/todoist", maxAge: 600,
  });
  return response;
}
