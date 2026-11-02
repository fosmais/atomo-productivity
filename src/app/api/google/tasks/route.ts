import { NextResponse, connection } from "next/server";
import { google } from "googleapis";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createGoogleOAuthClient } from "@/lib/google-calendar";
import { decryptGoogleToken, encryptGoogleToken } from "@/lib/google-token-crypto";

/** Read-only, on-demand Google Tasks preview. Never writes tasks automatically. */
export async function GET() {
  await connection();
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error) return NextResponse.json({ error: "MFA indisponível." }, { status: 503 });
  if (assurance.data.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2")
    return NextResponse.json({ error: "Segundo fator obrigatório.", code: "MFA_REQUIRED" }, { status: 403 });

  const admin = createSupabaseAdmin();
  const { data: saved, error: lookupError } = await admin.from("google_calendar_connections")
    .select("encrypted_access_token,encrypted_refresh_token,token_expires_at")
    .eq("user_id", user.id).maybeSingle();
  if (lookupError) return NextResponse.json({ error: "Falha na conexão." }, { status: 503 });
  if (!saved) return NextResponse.json({ connected: false, lists: [], tasks: [] });

  try {
    const oauth = createGoogleOAuthClient();
    oauth.setCredentials({
      access_token: decryptGoogleToken(saved.encrypted_access_token),
      refresh_token: saved.encrypted_refresh_token ? decryptGoogleToken(saved.encrypted_refresh_token) : undefined,
      expiry_date: saved.token_expires_at ? Date.parse(saved.token_expires_at) : undefined,
    });
    let tokenSave: Promise<void> = Promise.resolve();
    oauth.on("tokens", tokens => {
      const update: Record<string, string> = { updated_at: new Date().toISOString() };
      if (tokens.access_token) update.encrypted_access_token = encryptGoogleToken(tokens.access_token);
      if (tokens.refresh_token) update.encrypted_refresh_token = encryptGoogleToken(tokens.refresh_token);
      if (tokens.expiry_date) update.token_expires_at = new Date(tokens.expiry_date).toISOString();
      tokenSave = tokenSave.then(async () => {
        const { error: saveError } = await admin.from("google_calendar_connections")
          .update(update).eq("user_id", user.id);
        if (saveError) throw new Error("Falha ao atualizar credenciais.");
      });
    });
    const api = google.tasks({ version: "v1", auth: oauth });
    const lists: Array<{ id: string; title: string }> = [];
    let pageToken: string | undefined;
    for (let page = 0; page < 5; page++) {
      const result = await api.tasklists.list({ maxResults: 100, pageToken });
      for (const item of result.data.items ?? []) {
        if (item.id) lists.push({ id: item.id, title: item.title || "Lista" });
      }
      pageToken = result.data.nextPageToken || undefined;
      if (!pageToken) break;
    }
    const tasks: Array<{ id: string; listId: string; title: string; dueDate: string | null }> = [];
    for (const list of lists.slice(0, 30)) {
      let next: string | undefined;
      for (let page = 0; page < 5; page++) {
        const result = await api.tasks.list({
          tasklist: list.id, showCompleted: false, showDeleted: false,
          showHidden: false, maxResults: 100, pageToken: next,
        });
        for (const item of result.data.items ?? []) {
          if (item.id && item.title?.trim() && item.status !== "completed") {
            tasks.push({ id: item.id, listId: list.id, title: item.title.trim().slice(0, 200),
              dueDate: item.due?.slice(0, 10) || null });
          }
        }
        next = result.data.nextPageToken || undefined;
        if (!next || tasks.length >= 500) break;
      }
      if (tasks.length >= 500) break;
    }
    await tokenSave;
    return NextResponse.json({ connected: true, lists, tasks: tasks.slice(0, 500) },
      { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const status = (err as { code?: number; response?: { status?: number } })?.response?.status ??
      (err as { code?: number })?.code;
    if (status === 403 || status === 401) {
      return NextResponse.json({
        error: "Autorize novamente o Google para permitir leitura das tarefas.",
        code: "GOOGLE_TASKS_RECONSENT_REQUIRED", reconnectUrl: "/api/google/connect",
      }, { status: 409 });
    }
    return NextResponse.json({ error: "Não foi possível consultar o Google Tasks." }, { status: 502 });
  }
}
