import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { createHash } from "node:crypto";
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
    const eventId = "myryra" + createHash("sha256").update(JSON.stringify([user.id, title, start, end])).digest("hex").slice(0, 40);
    const { data: localEvents, error: localError } = await supabase.from("events")
      .select("starts_at, ends_at").eq("user_id", user.id).is("deleted_at", null)
      .lt("starts_at", new Date(end).toISOString()).gt("ends_at", new Date(start).toISOString()).limit(1);
    if (localError) throw new Error("local_availability");
    if ((localEvents ?? []).length) return NextResponse.json({ error: "Este horário já está ocupado na MYRYRA." }, { status: 409 });
    // Idempotent retries must succeed before checking the Google overlap.
    try {
      const existing = await calendar.events.get({ calendarId: "primary", eventId });
      if (existing.data.id === eventId) return NextResponse.json({ created: false, alreadyExists: true, id: existing.data.id, url: existing.data.htmlLink }, { headers: { "Cache-Control": "private, no-store" } });
    } catch (lookupError) {
      const status = (lookupError as { code?: number; response?: { status?: number } }).response?.status ?? (lookupError as { code?: number }).code;
      if (status !== 404) throw lookupError;
    }
    // Check every selected Google calendar; do not silently assume the primary is the only one.
    const calendarIds: string[] = [];
    let calendarPage: string | undefined;
    const seenPages = new Set<string>();
    do {
      const page = await calendar.calendarList.list({ maxResults: 100, pageToken: calendarPage });
      for (const entry of page.data.items ?? []) {
        if (entry.id && entry.selected !== false) calendarIds.push(entry.id);
      }
      const next = page.data.nextPageToken ?? undefined;
      if (next && seenPages.has(next)) throw new Error("google_calendar_pagination");
      if (next) seenPages.add(next);
      calendarPage = next;
    } while (calendarPage);
    if (!calendarIds.includes("primary") && calendarIds.length === 0) throw new Error("google_calendar_list_empty");
    for (const calendarId of calendarIds) {
      const busy = await calendar.events.list({ calendarId, timeMin: new Date(start).toISOString(), timeMax: new Date(end).toISOString(), singleEvents: true, maxResults: 100 });
      if (busy.data.nextPageToken || (busy.data.items ?? []).some(event => event.status !== "cancelled" && event.transparency !== "transparent" && (event.start?.dateTime || event.start?.date))) {
        return NextResponse.json({ error: "Este horário já está ocupado em um dos seus calendários Google." }, { status: 409 });
      }
    }
    let result;
    try {
      result = await calendar.events.insert({
      calendarId: "primary",
      requestBody: {
        id: eventId,
        summary: title,
        description: "Revisão de aprendizagem MIKA · MYRYRA. Criada após confirmação explícita.",
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
    console.error("MIKA Google Calendar event creation failed", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ error: "Não foi possível criar o evento no Google. Confira sua conexão e tente novamente." }, { status: 503 });
  }
}
