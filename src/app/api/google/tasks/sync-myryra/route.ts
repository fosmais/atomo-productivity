import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { google } from "googleapis";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createGoogleOAuthClient } from "@/lib/google-calendar";
import { decryptGoogleToken, encryptGoogleToken } from "@/lib/google-token-crypto";

const WRITE_SCOPE = "https://www.googleapis.com/auth/calendar.events";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const dateOnly = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return NextResponse.json({ error: "Origem não autorizada." }, { status: 403 });
  }
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error) return NextResponse.json({ error: "Verificação indisponível." }, { status: 503 });
  if (assurance.data.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2") {
    return NextResponse.json({ error: "Segundo fator obrigatório." }, { status: 403 });
  }
  let body: { taskId?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Dados inválidos." }, { status: 400 }); }
  const taskId = typeof body.taskId === "string" ? body.taskId : "";
  if (!uuid.test(taskId)) return NextResponse.json({ error: "Tarefa inválida." }, { status: 400 });
  const { data: task, error: taskError } = await supabase.from("tasks")
    .select("id,title,due_date,completed,status")
    .eq("id", taskId).eq("user_id", user.id).is("deleted_at", null).maybeSingle();
  if (taskError || !task || task.completed || task.status === "done" || !task.title?.trim() || task.title.length > 200 ||
      !task.due_date || !dateOnly.test(task.due_date) ||
      Number.isNaN(Date.parse(task.due_date)) ||
      new Date(task.due_date).toISOString().slice(0, 10) !== task.due_date) {
    return NextResponse.json({ error: "Somente tarefas pendentes com prazo válido podem ser enviadas." }, { status: 409 });
  }
  try {
    const admin = createSupabaseAdmin();
    const { data: connection, error: connectionError } = await admin.from("google_calendar_connections")
      .select("encrypted_access_token,encrypted_refresh_token,token_expires_at")
      .eq("user_id", user.id).maybeSingle();
    if (connectionError) throw new Error("connection_lookup");
    if (!connection) return NextResponse.json({ error: "Conecte o Google Calendar." }, { status: 409 });
    const oauth = createGoogleOAuthClient();
    oauth.setCredentials({
      access_token: decryptGoogleToken(connection.encrypted_access_token),
      refresh_token: connection.encrypted_refresh_token ? decryptGoogleToken(connection.encrypted_refresh_token) : undefined,
      expiry_date: connection.token_expires_at ? Date.parse(connection.token_expires_at) : undefined,
    });
    let tokenSave = Promise.resolve();
    oauth.on("tokens", tokens => {
      const update: Record<string, string> = { updated_at: new Date().toISOString() };
      if (tokens.access_token) update.encrypted_access_token = encryptGoogleToken(tokens.access_token);
      if (tokens.refresh_token) update.encrypted_refresh_token = encryptGoogleToken(tokens.refresh_token);
      if (tokens.expiry_date) update.token_expires_at = new Date(tokens.expiry_date).toISOString();
      tokenSave = tokenSave.then(async () => {
        const { error } = await admin.from("google_calendar_connections").update(update).eq("user_id", user.id);
        if (error) throw new Error("google_token_persistence");
      });
    });
    const refreshed = await oauth.getAccessToken();
    if (!refreshed.token) throw new Error("google_access_token_unavailable");
    await tokenSave;
    const info = await oauth.getTokenInfo(refreshed.token);
    if (!info.scopes.includes(WRITE_SCOPE)) {
      return NextResponse.json({ error: "Autorize a criação de eventos no Google Calendar.", code: "GOOGLE_WRITE_CONSENT_REQUIRED" }, { status: 403 });
    }
    const calendar = google.calendar({ version: "v3", auth: oauth });
    const eventId = "myrt" + createHash("sha256").update(JSON.stringify([user.id, taskId])).digest("hex").slice(0, 40);
    const day = new Date(task.due_date + "T00:00:00Z");
    day.setUTCDate(day.getUTCDate() + 1);
    const nextDay = day.toISOString().slice(0, 10);
    // Due date is date-only: export an all-day reminder, never invent a meeting time.
    const requestBody = {
      id: eventId,
      summary: task.title.trim(),
      description: "Tarefa MYRYRA · lembrete de dia inteiro enviado mediante autorização explícita.",
      start: { date: task.due_date },
      end: { date: nextDay },
    };
    try {
      const existing = await calendar.events.get({ calendarId: "primary", eventId });
      if (existing.data.id === eventId) {
        return NextResponse.json({ created: false, alreadyExists: true, id: existing.data.id, url: existing.data.htmlLink }, { headers: { "Cache-Control": "private, no-store" } });
      }
    } catch (lookupError) {
      const status = (lookupError as { code?: number; response?: { status?: number } }).response?.status ?? (lookupError as { code?: number }).code;
      if (status !== 404) throw lookupError;
    }
    try {
      const result = await calendar.events.insert({ calendarId: "primary", requestBody });
      return NextResponse.json({ created: true, id: result.data.id, url: result.data.htmlLink }, { headers: { "Cache-Control": "private, no-store" } });
    } catch (insertError) {
      const status = (insertError as { code?: number; response?: { status?: number } }).response?.status ?? (insertError as { code?: number }).code;
      if (status !== 409) throw insertError;
      const existing = await calendar.events.get({ calendarId: "primary", eventId });
      return NextResponse.json({ created: false, alreadyExists: true, id: existing.data.id, url: existing.data.htmlLink }, { headers: { "Cache-Control": "private, no-store" } });
    }
  } catch (error) {
    const status = (error as { code?: number | string; response?: { status?: number } }).response?.status ?? (error as { code?: number | string }).code;
    const message = error instanceof Error ? error.message : "";
    if (status === 401 || message.includes("invalid_grant") || message.includes("google_access_token_unavailable")) {
      return NextResponse.json({ error: "Autorização do Google expirada. Reconecte sua conta.", code: "GOOGLE_CALENDAR_RECONNECT_REQUIRED" }, { status: 409 });
    }
    if (status === 403) return NextResponse.json({ error: "Permissão do Google Calendar negada." }, { status: 403 });
    console.error("MYRYRA Google task export failed", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ error: "Falha ao enviar tarefa ao Google. Tente novamente." }, { status: 503 });
  }
}
