import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/supabase/request-client";
import { buildMikaDailyBriefing } from "@/lib/mika/daily-briefing";
import { generatePlanningWindows } from "@/lib/planning-windows";
import { proposeTaskSlots } from "@/lib/mika/autopilot-task-slots";
import { checkConciergeRateLimit } from "@/lib/rate-limit";

/** Read-only daily plan. Never performs mutations or approves actions. */
export async function POST(request: Request) {
  try {
    const { supabase, user, mfaRequired, assuranceUnavailable } = await authenticateRequest(request);
    if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    if (assuranceUnavailable) return NextResponse.json({ error: "Verificação de sessão indisponível." }, { status: 503 });
    if (mfaRequired) return NextResponse.json({ error: "Segundo fator obrigatório." }, { status: 403 });
    let limit;
    try { limit = await checkConciergeRateLimit(user.id); }
    catch { return NextResponse.json({ error: "Limite de acesso temporariamente indisponível." }, { status: 503 }); }
    if (!limit.allowed) return NextResponse.json({ error: "Muitas solicitações. Tente novamente mais tarde." }, { status: 429, headers: { "Retry-After": String(Math.max(1, Math.ceil((limit.reset - Date.now()) / 1000))) } });
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
    const [tasksResult, eventsResult, preferencesResult] = await Promise.all([
      supabase.from("tasks").select("id, title, priority, due_date, completed, duration_minutes").eq("user_id", user.id).eq("completed", false).is("deleted_at", null).limit(201),
      supabase.from("events").select("title, starts_at, ends_at, blocks_time").eq("user_id", user.id).is("deleted_at", null).lt("starts_at", dayEnd).gt("ends_at", dayStart).limit(201),
      supabase.from("planning_preferences").select("start_time, end_time, weekdays, time_zone").eq("user_id",user.id).maybeSingle(),
    ]);
    if (tasksResult.error || eventsResult.error || preferencesResult.error) {
      console.error("[MIKA] Daily briefing query failed");
      return NextResponse.json({ error: "Não foi possível consultar sua agenda e tarefas." }, { status: 500 });
    }
    if ((tasksResult.data?.length ?? 0)>200 || (eventsResult.data?.length ?? 0)>200) {
      return NextResponse.json({error:"Agenda ou tarefas excedem o limite de análise."},{status:422});
    }
    const plan = buildMikaDailyBriefing({
      tasks: tasksResult.data ?? [], events: eventsResult.data ?? [],
      dayStart, dayEnd, now: new Date(now).toISOString(),
    });
    // Date-only deadlines are not converted to arbitrary UTC times. Overdue tasks
    // remain in the briefing; only undated tasks receive estimated focus slots.
    const candidates = (tasksResult.data ?? []).filter(t=>!t.due_date).map(t=>({
      id:t.id, importance: ["alta","high"].includes(String(t.priority).toLowerCase())?5:["media","média","medium"].includes(String(t.priority).toLowerCase())?3:1,
      durationMinutes:Number.isInteger(t.duration_minutes)&&t.duration_minutes>0&&t.duration_minutes<=1440?t.duration_minutes:25, dependsOn:[]
    })).sort((a,b)=>b.importance-a.importance||(a.id<b.id?-1:a.id>b.id?1:0)).slice(0,100);
    const busy = (eventsResult.data ?? []).map(e=>({start:Date.parse(e.starts_at),end:Date.parse(e.ends_at)}));
    const pref=preferencesResult.data;
    const preferences=pref?{startTime:pref.start_time.slice(0,5),endTime:pref.end_time.slice(0,5),weekdays:pref.weekdays,timeZone:pref.time_zone}:{startTime:"09:00",endTime:"18:00",weekdays:[1,2,3,4,5],timeZone:"America/Sao_Paulo"};
    const windows=generatePlanningWindows(preferences,new Date(start),2);
    const autopilot: ReturnType<typeof proposeTaskSlots>=[];
    for(const w of windows){
      const from=Math.max(start,w.start.getTime()),to=Math.min(end,w.end.getTime());
      if(to<=from)continue;
      autopilot.push(...proposeTaskSlots({start:from,end:to},busy,candidates.filter(t=>!autopilot.some(a=>a.id===t.id)),[],now));
    }
    return NextResponse.json({ plan, autopilot: { suggestions:autopilot.map(a=>({...a,title:(tasksResult.data ?? []).find(t=>t.id===a.id)?.title ?? 'Tarefa', estimated:!((tasksResult.data ?? []).some(t=>t.id===a.id&&Number.isInteger(t.duration_minutes)&&t.duration_minutes>0&&t.duration_minutes<=1440))})), timeZone:preferences.timeZone, fallbackMinutes:25, scope:"undated_tasks_only", mode:"read_only" }, mode: "read_only", generatedAt: new Date(now).toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Não foi possível preparar seu dia." }, { status: 500 });
  }
}
