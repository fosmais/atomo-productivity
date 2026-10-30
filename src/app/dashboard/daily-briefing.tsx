"use client";

import { useCallback, useEffect, useState } from "react";
import { getCloudPlans } from "@/lib/plan-cloud";
import { getCloudEvents, type CalendarEvent } from "@/lib/event-cloud";
import { getCloudAvailability } from "@/lib/cloud-availability";

type Briefing = {
  events: CalendarEvent[];
  priorities: Array<{ title: string; priority: string; dueDate: string | null }>;
  overdue: number;
  freeMinutes: number;
  conflicts: number;
};

function sameLocalDay(date: Date, reference: Date) {
  return date.getFullYear() === reference.getFullYear() &&
    date.getMonth() === reference.getMonth() &&
    date.getDate() === reference.getDate();
}

export default function DailyBriefing() {
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [plans, events, availability] = await Promise.all([
        getCloudPlans(), getCloudEvents(), getCloudAvailability(new Date(), 1),
      ]);
      const today = new Date();
      const todayKey = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, "0"), String(today.getDate()).padStart(2, "0")].join("-");
      const pending = plans.flatMap((plan) => plan.tasks)
        .filter((task) => !task.completed)
        .map((task) => ({ title: task.title, priority: task.priority, dueDate: task.dueDate }));
      const priorities = pending
        .filter((task) => task.priority === "Alta" || (task.dueDate && task.dueDate <= todayKey))
        .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"))
        .slice(0, 4);
      const todayEvents = events.filter((event) => {
        const start = new Date(event.startsAt);
        const end = new Date(event.endsAt);
        const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const dayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
        return start < dayEnd && end > dayStart;
      }).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
      const blocked = todayEvents.filter((event) => event.blocksTime);
      let conflicts = 0;
      for (let i = 0; i < blocked.length; i++) {
        for (let j = i + 1; j < blocked.length; j++) {
          if (new Date(blocked[i].startsAt) < new Date(blocked[j].endsAt) &&
              new Date(blocked[j].startsAt) < new Date(blocked[i].endsAt)) conflicts++;
        }
      }
      const freeMinutes = availability.flatMap((day) => day.available)
        .reduce((sum, interval) => sum + Math.max(0, Math.round((interval.end.getTime() - interval.start.getTime()) / 60000)), 0);
      setBriefing({ events: todayEvents, priorities, overdue: pending.filter((task) => task.dueDate && task.dueDate < todayKey).length, freeMinutes, conflicts });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível montar o resumo do dia.");
      setBriefing(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <section className="rounded-2xl border border-violet-500/30 bg-slate-900 p-5 text-white" aria-label="Resumo do dia">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-violet-400">MYRYRA · DAILY BRIEFING</p>
          <h3 className="mt-1 text-xl font-semibold">Seu dia em perspectiva.</h3>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading}
          className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 disabled:opacity-50">
          {loading ? "Atualizando..." : "Atualizar"}
        </button>
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-rose-300">{error}</p>}
      {briefing && (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              ["Compromissos", String(briefing.events.length)],
              ["Tempo livre", `${Math.floor(briefing.freeMinutes / 60)}h ${String(briefing.freeMinutes % 60).padStart(2, "0")}min`],
              ["Atrasadas", String(briefing.overdue)],
              ["Conflitos MYRYRA", String(briefing.conflicts)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-slate-700 bg-slate-950 p-3">
                <p className="text-xs text-slate-400">{label}</p>
                <p className="mt-1 text-xl font-semibold text-violet-200">{value}</p>
              </div>
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h4 className="text-sm font-semibold text-violet-200">Prioridades</h4>
              {briefing.priorities.length === 0 ? <p className="mt-2 text-sm text-slate-400">Nenhuma prioridade urgente.</p> :
                <ul className="mt-2 space-y-2 text-sm text-slate-200">{briefing.priorities.map((task, i) => <li key={i} className="rounded-lg bg-slate-800 p-2">{task.title}</li>)}</ul>}
            </div>
            <div>
              <h4 className="text-sm font-semibold text-violet-200">Agenda de hoje</h4>
              {briefing.events.length === 0 ? <p className="mt-2 text-sm text-slate-400">Nenhum evento MYRYRA para hoje.</p> :
                <ul className="mt-2 space-y-2 text-sm text-slate-200">{briefing.events.slice(0, 5).map((event) => (
                  <li key={event.id} className="rounded-lg bg-slate-800 p-2">
                    {new Date(event.startsAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} · {event.title}
                  </li>
                ))}</ul>}
            </div>
          </div>
          <p className="text-xs text-slate-400">Resumo dos dados MYRYRA. O tempo livre considera as janelas de planejamento e eventos bloqueantes da MYRYRA; compromissos externos não estão incluídos neste cálculo.</p>
        </div>
      )}
    </section>
  );
}
