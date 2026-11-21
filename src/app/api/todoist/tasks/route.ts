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
    // Bounded pagination prevents unbounded provider calls and protects the UI.
    const tasks: Array<{ id: string; title: string; dueDate: string | null }> = [];
    const seenCursors = new Set<string>();
    const seenTaskIds = new Set<string>();
    let cursor: string | null = null;
    for (let page = 0; page < 5 && tasks.length < 500; page++) {
      const url = new URL("https://api.todoist.com/api/v1/tasks");
      url.searchParams.set("limit", "200");
      if (cursor) url.searchParams.set("cursor", cursor);
      const response = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store", signal: AbortSignal.timeout(10000),
      });
      if (response.status === 401 || response.status === 403)
        return NextResponse.json({ error: "Reconecte o Todoist.", code: "TODOIST_RECONNECT_REQUIRED" }, { status: 409 });
      if (!response.ok) throw new Error("Todoist indisponível.");
      const payload: unknown = await response.json();
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("Resposta Todoist inválida.");
      const data = payload as { results?: unknown; next_cursor?: unknown };
      if (!Array.isArray(data.results)) throw new Error("Lista Todoist inválida.");
      for (const item of data.results) {
        if (!item || typeof item !== "object") continue;
        const row = item as Record<string, unknown>;
        if (typeof row.id !== "string" || typeof row.content !== "string" || !row.content.trim() || seenTaskIds.has(row.id)) continue;
        seenTaskIds.add(row.id);
        const due = row.due && typeof row.due === "object" ? (row.due as Record<string, unknown>).date : null;
        tasks.push({ id: row.id, title: row.content.trim().slice(0, 200),
          dueDate: typeof due === "string" ? due.slice(0, 10) : null });
        if (tasks.length >= 500) break;
      }
      if (!data.next_cursor) break;
      if (typeof data.next_cursor !== "string" || seenCursors.has(data.next_cursor)) throw new Error("Paginação Todoist inválida.");
      seenCursors.add(data.next_cursor);
      cursor = data.next_cursor;
    }
    return NextResponse.json({ connected: true, tasks }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Não foi possível consultar tarefas do Todoist." }, { status: 502 });
  }
}
