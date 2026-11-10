import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createGoogleOAuthClient } from "@/lib/google-calendar";
import { decryptGoogleToken } from "@/lib/google-token-crypto";

const WRITE_SCOPE = "https://www.googleapis.com/auth/calendar.events";

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return NextResponse.json({ error: "Origem não autorizada." }, { status: 403 });
  }
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error) return NextResponse.json({ error: "Verificação de sessão indisponível." }, { status: 503 });
  if (assurance.data.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2") {
    return NextResponse.json({ error: "Segundo fator obrigatório." }, { status: 403 });
  }
  let body: { title?: unknown; startsAt?: unknown; endsAt?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Dados inválidos." }, { status: 400 }); }
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const start = typeof body.startsAt === "string" ? Date.parse(body.startsAt) : NaN;
  const end = typeof body.endsAt === "string" ? Date.parse(body.endsAt) : NaN;
  if (!title || title.length > 200 || !Number.isFinite(start) || !Number.isFinite(end) || start <= Date.now() || end - start !== 20 * 60_000) {
    return NextResponse.json({ error: "Informe um treinamento futuro de 20 minutos." }, { status: 400 });
  }
  try {
    const admin = createSupabaseAdmin();
    const { data: connection, error } = await admin.from("google_calendar_connections")
      .select("encrypted_access_token, encrypted_refresh_token, token_expires_at")
      .eq("user_id", user.id).maybeSingle();
    if (error) throw new Error("connection_lookup");
    if (!connection) return NextResponse.json({ error: "Conecte o Google Calendar." }, { status: 409 });
    const oauth = createGoogleOAuthClient();
    const accessToken = decryptGoogleToken(connection.encrypted_access_token);
    const refreshToken = connection.encrypted_refresh_token ? decryptGoogleToken(connection.encrypted_refresh_token) : undefined;
    oauth.setCredentials({ access_token: accessToken, refresh_token: refreshToken, expiry_date: connection.token_expires_at ? Date.parse(connection.token_expires_at) : undefined });
    const tokenInfo = await oauth.getTokenInfo(accessToken);
    if (!tokenInfo.scopes.includes(WRITE_SCOPE)) {
      return NextResponse.json({ error: "Autorize a criação de eventos no Google antes de continuar.", code: "GOOGLE_WRITE_CONSENT_REQUIRED" }, { status: 403 });
    }
    const calendar = google.calendar({ version: "v3", auth: oauth });
    const result = await calendar.events.insert({
      calendarId: "primary",
      requestBody: {
        summary: title,
        description: "Revisão de aprendizagem MIKA · MYRYRA. Criada após confirmação explícita.",
        start: { dateTime: new Date(start).toISOString() },
        end: { dateTime: new Date(end).toISOString() },
      },
    });
    return NextResponse.json({ created: true, id: result.data.id, url: result.data.htmlLink }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("MIKA Google Calendar event creation failed", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ error: "Não foi possível criar o evento no Google. Confira sua conexão e tente novamente." }, { status: 503 });
  }
}
