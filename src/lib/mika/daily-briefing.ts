/**
 * Read-only daily briefing core for MIKA Agente.
 * No database writes, external calls, or automatic changes.
 * Dates must be ISO timestamps; caller supplies the user's local day boundaries.
 */
export type MikaTask = { title: string; priority?: string | null; due_date?: string | null; completed?: boolean };
export type MikaEvent = { title: string; starts_at: string; ends_at: string; blocks_time?: boolean | null };
export type MikaDayPlan = {
  pendingTasks: number;
  overdueTasks: number;
  todayEvents: number;
  conflicts: { first: string; second: string }[];
  priorities: { title: string; priority: string; dueDate: string | null }[];
  freeSlots: { startsAt: string; endsAt: string; minutes: number }[];
  focusSuggestion: { title: string; startsAt: string; endsAt: string; minutes: number } | null;
  requiresApproval: true;
};

const time = (value: string) => new Date(value).getTime();
const priorityScores: Record<string, number> = { alta: 3, high: 3, média: 2, media: 2, medium: 2, normal: 1, baixa: 1, low: 1 };
const score = (p?: string | null) => priorityScores[String(p ?? "").toLowerCase()] ?? 1;

export function buildMikaDailyBriefing(input: {
  tasks: MikaTask[];
  events: MikaEvent[];
  dayStart: string;
  dayEnd: string;
  now: string;
}): MikaDayPlan {
  const start = time(input.dayStart), end = time(input.dayEnd), now = time(input.now);
  if (![start, end, now].every(Number.isFinite) || end <= start || end - start > 86400000) {
    throw new Error("Invalid day boundaries");
  }
  const pending = input.tasks.filter(t => !t.completed && typeof t.title === "string" && t.title.trim());
  const validEvents = input.events.filter(e => Number.isFinite(time(e.starts_at)) && Number.isFinite(time(e.ends_at)) && time(e.ends_at) > time(e.starts_at) && time(e.starts_at) < end && time(e.ends_at) > start);
  const events = validEvents
    .filter(e => e.blocks_time !== false)
    .map(e => ({ title: e.title, start: Math.max(start, time(e.starts_at)), end: Math.min(end, time(e.ends_at)) }))
    .filter(e => e.end > e.start)
    .sort((a,b) => a.start-b.start);
  const conflicts: MikaDayPlan["conflicts"] = [];
  for (let i=0; i<events.length; i++) {
    for (let j=i+1; j<events.length && events[j].start<events[i].end; j++) {
      conflicts.push({ first: events[i].title, second: events[j].title });
    }
  }
  const slots: MikaDayPlan["freeSlots"] = [];
  let cursor = Math.max(start, Math.min(end, now));
  for (const event of events) {
    if (event.start > cursor && event.start-cursor >= 15*60000) {
      slots.push({ startsAt: new Date(cursor).toISOString(), endsAt: new Date(event.start).toISOString(), minutes: Math.floor((event.start-cursor)/60000) });
    }
    cursor = Math.max(cursor, event.end);
  }
  if (end-cursor >= 15*60000) slots.push({ startsAt: new Date(cursor).toISOString(), endsAt: new Date(end).toISOString(), minutes: Math.floor((end-cursor)/60000) });
  return {
    pendingTasks: pending.length,
    overdueTasks: pending.filter(t => t.due_date && /^\d{4}-\d{2}-\d{2}$/.test(t.due_date) && t.due_date < input.dayStart.slice(0,10)).length,
    todayEvents: validEvents.length,
    conflicts,
    priorities: [...pending].sort((a,b) => score(b.priority)-score(a.priority) || String(a.due_date ?? "9999").localeCompare(String(b.due_date ?? "9999"))).slice(0,3).map(t => ({ title: t.title, priority: t.priority ?? "Normal", dueDate: t.due_date ?? null })),
    freeSlots: slots.slice(0,10),
    focusSuggestion: pending.length && slots.some(slot => slot.minutes >= 25) ? (() => {
      const selected = slots.find(slot => slot.minutes >= 25)!;
      const top = [...pending].sort((a,b) => score(b.priority)-score(a.priority) || String(a.due_date ?? '9999').localeCompare(String(b.due_date ?? '9999')))[0];
      return { title: `Foco: ${top.title}`, startsAt: selected.startsAt, endsAt: new Date(time(selected.startsAt) + 25 * 60000).toISOString(), minutes: 25 };
    })() : null,
    requiresApproval: true
  };
}
