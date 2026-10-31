"use client";

import { useEffect, useState } from "react";
import { getCloudPlans } from "@/lib/plan-cloud";
import { getCloudEvents } from "@/lib/event-cloud";

type Item = { id?: string; title: string; priority: string; dueDate: string | null; completed: boolean };
type Appointment = { title: string; startsAt: string };

function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export default function MyDay() {
  const [tasks, setTasks] = useState<Item[]>([]);
  const [events, setEvents] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [plans, calendar] = await Promise.all([getCloudPlans(), getCloudEvents()]);
        if (!active) return;
        setTasks(plans.flatMap(plan => plan.tasks));
        setEvents(calendar.map(event => ({ title: event.title, startsAt: event.startsAt })));
        setError("");
      } catch {
        if (active) setError("Não foi possível carregar o resumo do dia.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    window.addEventListener("myryra:tasks-updated", load);
    window.addEventListener("myryra:events-updated", load);
    return () => { active = false; window.removeEventListener("myryra:tasks-updated", load); window.removeEventListener("myryra:events-updated", load); };
  }, []);
  const today = localDateKey(new Date());
  const todayTasks = tasks.filter(task => task.dueDate === today);
  const priorityRank: Record<string, number> = { Alta: 0, "Média": 1, Normal: 2 };
  const pending = tasks.filter(task => !task.completed && (!task.dueDate || task.dueDate <= today))
    .sort((a, b) => (a.dueDate && a.dueDate < today ? -1 : 0) - (b.dueDate && b.dueDate < today ? -1 : 0) || (priorityRank[a.priority] ?? 3) - (priorityRank[b.priority] ?? 3));
  const appointments = events.filter(event => localDateKey(new Date(event.startsAt)) === today)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const finished = todayTasks.filter(task => task.completed).length;
  return <section className="rounded-2xl border border-violet-500/30 bg-slate-900 p-5 text-white" aria-label="Meu Dia">
    <p className="text-xs font-semibold uppercase tracking-widest text-violet-400">MYRYRA · MEU DIA</p>
    <h3 className="mt-2 text-xl font-semibold">O que merece sua atenção hoje?</h3>
    {loading ? <p className="mt-3 text-sm text-slate-300">Carregando suas prioridades...</p> : error ? <p role="alert" className="mt-3 text-rose-300">{error}</p> : <>
      <p className="mt-3 text-sm text-slate-300">{finished} de {todayTasks.length} tarefas com prazo hoje concluídas · {appointments.length} compromisso(s) hoje</p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-700" role="progressbar" aria-valuenow={finished} aria-valuemin={0} aria-valuemax={todayTasks.length || 1} aria-label="Tarefas concluídas hoje"><div className="h-full rounded-full bg-violet-500" style={{ width: `${todayTasks.length ? finished / todayTasks.length * 100 : 0}%` }} /></div>
      <h4 className="mt-5 font-semibold text-violet-200">Suas 3 próximas prioridades</h4>
      {pending.length ? <ol className="mt-2 space-y-2">{pending.slice(0, 3).map(task => <li key={task.id ?? task.title} className="rounded-lg border border-slate-700 p-3 text-sm">{task.title} <span className="text-slate-400">· {task.priority}{task.dueDate && task.dueDate < today ? " · Atrasada" : ""}</span></li>)}</ol> : <p className="mt-2 text-sm text-slate-400">Nenhuma tarefa pendente ou atrasada. Aproveite para planejar o próximo passo.</p>}
      <h4 className="mt-5 font-semibold text-violet-200">Agenda de hoje</h4>
      {appointments.length ? <ul className="mt-2 space-y-2">{appointments.slice(0, 5).map((event, index) => <li key={index} className="text-sm text-slate-300">{new Date(event.startsAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} · {event.title}</li>)}</ul> : <p className="mt-2 text-sm text-slate-400">Sem compromissos na agenda MYRYRA hoje.</p>}
      <p className="mt-3 text-xs text-slate-400">Resumo baseado nas tarefas e eventos MYRYRA. Eventos externos do Google ainda não estão incluídos.</p>
    </>}
  </section>;
}
