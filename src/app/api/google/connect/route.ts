import { NextResponse, connection } from "next/server";
import { randomBytes } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import {
  createGoogleOAuthClient,
  GOOGLE_CALENDAR_SCOPES,
} from "@/lib/google-calendar";

export async function GET(request: Request) {
  await connection();
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    // Browser navigation: guide users to login instead of showing raw JSON.
    const url = new URL(request.url);
    return NextResponse.redirect(new URL("/login", url.origin));
  }

  const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error) return NextResponse.json({ error: "Verificação de sessão indisponível." }, { status: 503 });
  if (assurance.data.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2") {
    return NextResponse.json({ error: "Segundo fator obrigatório.", code: "MFA_REQUIRED" }, { status: 403 });
  }

  try {
    const oauth = createGoogleOAuthClient();
    const state = randomBytes(32).toString("hex");
    const statePayload = JSON.stringify({
      state,
      userId: user.id,
    });

    const authorizationUrl = oauth.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: GOOGLE_CALENDAR_SCOPES,
      state,
    });

    const response = NextResponse.redirect(authorizationUrl);

    response.cookies.set("vyra_google_oauth_state", statePayload, {
      httpOnly: true,
      secure: new URL(request.url).protocol === "https:",
      sameSite: "lax",
      path: "/api/google",
      maxAge: 600,
    });

    return response;
  } catch {
    return NextResponse.json(
      { error: "Não foi possível iniciar a conexão com o Google." },
      { status: 503 }
    );
  }
}