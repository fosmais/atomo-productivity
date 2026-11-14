import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { createHash } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createGoogleOAuthClient } from "@/lib/google-calendar";
import { decryptGoogleToken, encryptGoogleToken } from "@/lib/google-token-crypto";

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
  let body: { title?: unknown; startsAt?: unknown; endsAt?: unknown; location?: unknown; localEventId?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Dados inválidos." }, { status: 400 }); }
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const start = typeof body.startsAt === "string" ? Date.parse(body.startsAt) : NaN;
  const end = typeof body.endsAt === "string" ? Date.parse(body.endsAt) : NaN;
  const localEventId = typeof body.localEventId === "string" ? body.localEventId : "";

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(localEventId) || !title || title.length > 200 || !Number.isFinite(start) || !Number.isFinite(end) || start <= Date.now() || end <= start || end - start > 24 * 60 * 60_000) {
    return NextResponse.json({ error: "Informe um compromisso futuro válido, com duração máxima de 24 horas." }, { status: 400 });
  }
  try {
    const admin = createSupabaseAdmin();
    const { data: connection, error } = await admin.from("google_calendar_connections")
      .select("encrypted_access_token, encrypted_refresh_token, token_expires_at")
      .eq("user_id", user.id).maybeSingle();
    if (error) throw new Error("connection_lookup");
    if (!connection) return NextResponse.json({ error: "Conecte o Google Calendar." }, { status: 409 });
    const { data: ownedEvent, error: ownedError } = await supabase.from("events")
      .select("id, title, starts_at, ends_at, location").eq("id", localEventId).eq("user_id", user.id).is("deleted_at", null).maybeSingle();
    if (ownedError || !ownedEvent || ownedEvent.title !== title || Date.parse(ownedEvent.starts_at) !== start || Date.parse(ownedEvent.ends_at) !== end) {
      return NextResponse.json({ error: "Compromisso MYRYRA não encontrado ou divergente." }, { status: 409 });
    }
    const oauth = createGoogleOAuthClient();
    const accessToken = decryptGoogleToken(connection.encrypted_access_token);
    const refreshToken = connection.encrypted_refresh_token ? decryptGoogleToken(connection.encrypted_refresh_token) : undefined;
    oauth.setCredentials({ access_token: accessToken, refresh_token: refreshToken, expiry_date: connection.token_expires_at ? Date.parse(connection.token_expires_at) : undefined });
    // Refresh expired access tokens before checking granted permissions.
    // Persist rotated credentials without exposing them to the browser.
    let tokenSave = Promise.resolve();
    oauth.on("tokens", tokens => {
      const update: Record<string, string> = { updated_at: new Date().toISOString() };
      if (tokens.access_token) update.encrypted_access_token = encryptGoogleToken(tokens.access_token);
      if (tokens.refresh_token) update.encrypted_refresh_token = encryptGoogleToken(tokens.refresh_token);
      if (tokens.expiry_date) update.token_expires_at = new Date(tokens.expiry_date).toISOString();
      tokenSave = tokenSave.then(async () => {
        const { error: saveError } = await admin.from("google_calendar_connections").update(update).eq("user_id", user.id);
        if (saveError) throw new Error("google_token_persistence");
      });
    });
    const refreshed = await oauth.getAccessToken();
    if (!refreshed.token) throw new Error("google_access_token_unavailable");
    await tokenSave;
    const tokenInfo = await oauth.getTokenInfo(refreshed.token);
    if (!tokenInfo.scopes.includes(WRITE_SCOPE)) {
      return NextResponse.json({ error: "Autorize a criação de eventos no Google antes de continuar.", code: "GOOGLE_WRITE_CONSENT_REQUIRED" }, { status: 403 });
    }
    const calendar = google.calendar({ version: "v3", auth: oauth });
    // Google Calendar IDs accept only base32hex characters (0-9, a-v); avoid the letter y.
    const eventId = "myra" + createHash("sha256").update(JSON.stringify([user.id, localEventId])).digest("hex").slice(0, 40);
    // Idempotent retries must succeed before checking the Google overlap.
    try {
      const existing = await calendar.events.get({ calendarId: "primary", eventId });
      if (existing.data.id === eventId) return NextResponse.json({ created: false, alreadyExists: true, id: existing.data.id, url: existing.data.htmlLink }, { headers: { "Cache-Control": "private, no-store" } });
    } catch (lookupError) {
      const status = (lookupError as { code?: number; response?: { status?: number } }).response?.status ?? (lookupError as { code?: number }).code;
      if (status !== 404) throw lookupError;
    }
    let result;
    try {
      result = await calendar.events.insert({
      calendarId: "primary",
      requestBody: {
        id: eventId,
        summary: title,
        description: "Compromisso MYRYRA · enviado ao Google mediante autorização explícita.",
        location: ownedEvent.location || undefined,
        start: { dateTime: new Date(start).toISOString() },
        end: { dateTime: new Date(end).toISOString() },
      },
      });
    } catch (insertError) {
      const status = (insertError as { code?: number; response?: { status?: number } }).response?.status ?? (insertError as { code?: number }).code;
      if (status !== 409) throw insertError;
      const existing = await calendar.events.get({ calendarId: "primary", eventId });
      return NextResponse.json({ created: false, alreadyExists: true, id: existing.data.id, url: existing.data.htmlLink }, { headers: { "Cache-Control": "private, no-store" } });
    }
    return NextResponse.json({ created: true, id: result.data.id, url: result.data.htmlLink }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const status = (error as { code?: number | string; response?: { status?: number } }).response?.status ?? (error as { code?: number | string }).code;
    const message = error instanceof Error ? error.message : "";
    if (status === 401 || message.includes("invalid_grant") || message.includes("google_access_token_unavailable")) {
      return NextResponse.json({
        error: "A autorização do Google expirou ou foi revogada. Reconecte sua conta.",
        code: "GOOGLE_CALENDAR_RECONNECT_REQUIRED",
        reconnectUrl: "/api/google/connect?allow_event_creation=1",
      }, { status: 409, headers: { "Cache-Control": "private, no-store" } });
    }
    if (status === 403) {
      return NextResponse.json({
        error: "O Google recusou a criação do evento. Verifique as permissões da sua conta.",
        code: "GOOGLE_CALENDAR_PERMISSION_DENIED",
      }, { status: 403, headers: { "Cache-Control": "private, no-store" } });
    }
    console.error("MIKA Google Calendar event creation failed", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ error: "Não foi possível criar o evento no Google. Tente novamente." }, { status: 503 });
  }
}
