import { NextResponse, connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { decryptTodoistToken } from "@/lib/todoist-token-crypto";

/** Read-only Todoist connection status and task preview. */
export async function GET() {
  await connection();
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error) return NextResponse.json({ error: "MFA indisponível." }, { status: 503 });
  if (assurance.data.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2")
    return NextResponse.json({ error: "Segundo fator obrigatório." }, { status: 403 });
  const admin = createSupabaseAdmin();
  const { data: saved, error: lookupError } = await admin.from("todoist_connections")
    .select("encrypted_access_token").eq("user_id", user.id).maybeSingle();
  if (lookupError) return NextResponse.json({ error: "Falha ao consultar conexão." }, { status: 503 });
  if (!saved) return NextResponse.json({ connected: false, tasks: [] }, { headers: { "Cache-Control": "no-store" } });
  try {
    const token = decryptTodoistToken(saved.encrypted_access_token);
    const response = await fetch("https://api.todoist.com/api/v1/tasks?limit=200", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store", signal: AbortSignal.timeout(10000),
    });
    if (response.status === 401 || response.status === 403)
      return NextResponse.json({ error: "Reconecte o Todoist.", code: "TODOIST_RECONNECT_REQUIRED" }, { status: 409 });
    if (!response.ok) throw new Error("Todoist indisponível.");
    const payload: unknown = await response.json();
    const items = Array.isArray(payload) ? payload : payload && typeof payload === "object" &&
      Array.isArray((payload as { results?: unknown }).results) ? (payload as { results: unknown[] }).results : [];
    const tasks = items.slice(0, 200).flatMap((item: unknown) => {
      if (!item || typeof item !== "object") return [];
      const row = item as Record<string, unknown>;
      if (typeof row.id !== "string" || typeof row.content !== "string" || !row.content.trim()) return [];
      const due = row.due && typeof row.due === "object" ? (row.due as Record<string, unknown>).date : null;
      return [{ id: row.id, title: row.content.trim().slice(0, 200),
        dueDate: typeof due === "string" ? due.slice(0, 10) : null }];
    });
    const nextCursor = payload && !Array.isArray(payload) && typeof payload === "object"
      ? (payload as { next_cursor?: unknown }).next_cursor : null;
    return NextResponse.json({ connected: true, tasks, hasMore: typeof nextCursor === "string" && nextCursor.length > 0 },
      { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Não foi possível consultar tarefas do Todoist." }, { status: 502 });
  }
}
