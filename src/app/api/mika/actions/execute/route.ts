import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkConciergeRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

// First release: explicit user-confirmed creation of a single task.
// Events and reminders remain proposal-only until their adapters are audited.
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error) return NextResponse.json({ error: "Verificação de sessão indisponível." }, { status: 503 });
  if (assurance.data.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2")
    return NextResponse.json({ error: "Segundo fator obrigatório.", code: "MFA_REQUIRED" }, { status: 403 });
  try {
    const limit = await checkConciergeRateLimit(user.id);
    if (!limit.allowed) return NextResponse.json({ error: "Limite de requisições." }, { status: 429 });
  } catch {
    return NextResponse.json({ error: "Serviço temporariamente indisponível." }, { status: 503 });
  }
  if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json"))
    return NextResponse.json({ error: "JSON obrigatório." }, { status: 415 });
  let raw = "";
  try {
    if (!request.body) throw new Error("missing");
    const reader = request.body.getReader();
    const decoder = new TextDecoder();
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4096) return NextResponse.json({ error: "Requisição muito grande." }, { status: 413 });
      raw += decoder.decode(value, { stream: true });
    }
    raw += decoder.decode();
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }
  let body: unknown;
  try { body = JSON.parse(raw); } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body))
    return NextResponse.json({ error: "Proposta inválida." }, { status: 400 });
  const input = body as Record<string, unknown>;
  if (input.approved !== true || input.type !== "create_task")
    return NextResponse.json({ error: "Aprovação explícita de tarefa obrigatória." }, { status: 400 });
  if (typeof input.title !== "string" || input.title.trim().length < 3 || input.title.length > 160)
    return NextResponse.json({ error: "Título inválido." }, { status: 400 });
  if (input.due_at !== null && input.due_at !== undefined &&
      (typeof input.due_at !== "string" || Number.isNaN(Date.parse(input.due_at))))
    return NextResponse.json({ error: "Prazo inválido." }, { status: 400 });
  const dueDate = typeof input.due_at === "string" ? input.due_at.slice(0, 10) : null;
  const { data, error } = await supabase.from("tasks")
    .insert({ user_id: user.id, title: input.title.trim(), priority: "Normal", due_date: dueDate, completed: false })
    .select("id,title,due_date").single();
  if (error) {
    console.error("MIKA task creation failed", { code: error.code });
    return NextResponse.json({ error: "Não foi possível salvar a tarefa." }, { status: 500 });
  }
  return NextResponse.json({ status: "executed", action: "create_task", task: data },
    { status: 201, headers: { "Cache-Control": "no-store" } });
}
