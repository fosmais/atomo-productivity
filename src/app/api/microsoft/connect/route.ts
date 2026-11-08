import { NextResponse, connection } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  await connection();
  if (process.env.MICROSOFT_INTEGRATION_ENABLED !== "true") return NextResponse.json({ error: "Integração Microsoft em homologação." }, { status: 503 });
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.redirect(new URL("/login", request.url));
  const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error || (assurance.data.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2"))
    return NextResponse.json({ error: "Verificação de sessão necessária." }, { status: 403 });
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const redirectUri = process.env.MICROSOFT_REDIRECT_URI;
  if (!clientId || !redirectUri || !process.env.MICROSOFT_CLIENT_SECRET || !process.env.MICROSOFT_TOKEN_ENCRYPTION_KEY)
    return NextResponse.json({ error: "Microsoft não configurado." }, { status: 503 });
  const expected = new URL("/api/microsoft/callback", request.url);
  const callback = new URL(redirectUri);
  if (callback.protocol !== "https:" || callback.origin !== expected.origin || callback.pathname !== expected.pathname)
    return NextResponse.json({ error: "Callback Microsoft inválido." }, { status: 503 });
  const state = randomBytes(32).toString("hex");
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const auth = new URL("https://login.microsoftonline.com/common/oauth2/v2.0/authorize");
  auth.searchParams.set("client_id", clientId);
  auth.searchParams.set("response_type", "code");
  auth.searchParams.set("redirect_uri", redirectUri);
  auth.searchParams.set("response_mode", "query");
  auth.searchParams.set("scope", "openid offline_access Calendars.Read");
  auth.searchParams.set("state", state);
  auth.searchParams.set("code_challenge", challenge);
  auth.searchParams.set("code_challenge_method", "S256");
  const response = NextResponse.redirect(auth);
  response.cookies.set("myryra_microsoft_oauth", JSON.stringify({ state, verifier, userId: user.id }), {
    httpOnly: true, secure: true, sameSite: "lax", path: "/api/microsoft", maxAge: 600,
  });
  return response;
}
