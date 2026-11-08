import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/supabase/request-client";
import { buildMikaDailyBriefing } from "@/lib/mika/daily-briefing";

/** Read-only daily plan. Never performs mutations or approves actions. */
export async function POST(request: Request) {
  try {
    const { supabase, user, mfaRequired, assuranceUnavailable } = await authenticateRequest(request);
    if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    if (assuranceUnavailable) return NextResponse.json({ error: "Verificação de sessão indisponível." }, { status: 503 });
    if (mfaRequired) return NextResponse.json({ error: "Segundo fator obrigatório." }, { status: 403 });
    if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) {
      return NextResponse.json({ error: "Envie JSON." }, { status: 415 });
    }
    const raw = await request.text();
    if (raw.length > 2048) return NextResponse.json({ error: "Requisição muito grande." }, { status: 413 });
    let body: unknown;
    try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: "JSON inválido." }, { status: 400 }); }
    if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Parâmetros inválidos." }, { status: 400 });
    const { dayStart, dayEnd } = body as Record<string, unknown>;
    if (typeof dayStart !== "string" || typeof dayEnd !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(dayStart) || !/^\d{4}-\d{2}-\d{2}T/.test(dayEnd) || !/(Z|[+-]\d{2}:\d{2})$/.test(dayStart) || !/(Z|[+-]\d{2}:\d{2})$/.test(dayEnd)) {
      return NextResponse.json({ error: "Informe o início e fim do dia com fuso horário." }, { status: 400 });
    }
    const start = new Date(dayStart).getTime(), end = new Date(dayEnd).getTime(), now = Date.now();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || end-start > 86400000 || Math.abs(start-now) > 3*86400000) {
      return NextResponse.json({ error: "Período inválido." }, { status: 400 });
    }
    const [tasksResult, eventsResult] = await Promise.all([
      supabase.from("tasks").select("title, priority, due_date, completed").eq("user_id", user.id).eq("completed", false).limit(200),
      supabase.from("events").select("title, starts_at, ends_at, blocks_time").eq("user_id", user.id).is("deleted_at", null).lt("starts_at", dayEnd).gt("ends_at", dayStart).limit(200),
    ]);
    if (tasksResult.error || eventsResult.error) {
      console.error("[MIKA] Daily briefing query failed");
      return NextResponse.json({ error: "Não foi possível consultar sua agenda e tarefas." }, { status: 500 });
    }
    const plan = buildMikaDailyBriefing({
      tasks: tasksResult.data ?? [], events: eventsResult.data ?? [],
      dayStart, dayEnd, now: new Date(now).toISOString(),
    });
    return NextResponse.json({ plan, mode: "read_only", generatedAt: new Date(now).toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Não foi possível preparar seu dia." }, { status: 500 });
  }
}
