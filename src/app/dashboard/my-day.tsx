"use client";
import FeatureHint from "./feature-hint";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
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
        const supabase = createClient();
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (authError || !auth.user) throw new Error("Faça login para visualizar seu dia.");
        const [taskResponse, calendar] = await Promise.all([
          supabase.from("tasks").select("id,title,priority,due_date,completed").eq("user_id", auth.user.id).limit(1000),
          getCloudEvents(),
        ]);
        if (taskResponse.error) throw taskResponse.error;
        if (!active) return;
        setTasks((taskResponse.data ?? []).map(task => ({
          id: task.id, title: task.title, priority: task.priority,
          dueDate: task.due_date, completed: task.completed,
        })));
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
  const overdue = tasks.filter(task => !task.completed && task.dueDate && task.dueDate < today);
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrow = localDateKey(tomorrowDate);
  const tomorrowTasks = tasks.filter(task => !task.completed && task.dueDate === tomorrow);
  return <section className="rounded-2xl border border-violet-500/30 bg-slate-900 p-5 text-white" aria-label="Meu Dia">
    <FeatureHint label="MYRYRA · MEU DIA" title="Tudo o que importa hoje" description="Mostra tarefas prioritárias, progresso e compromissos cadastrados na MYRYRA." tip="Eventos externos do Google ainda não fazem parte deste resumo." />
    <h3 className="mt-2 text-xl font-semibold">O que merece sua atenção hoje?</h3>
    {loading ? <p className="mt-3 text-sm text-slate-300">Carregando suas prioridades...</p> : error ? <p role="alert" className="mt-3 text-rose-300">{error}</p> : <>
      <p className="mt-3 text-sm text-slate-300">{finished} de {todayTasks.length} tarefas com prazo hoje concluídas · {appointments.length} compromisso(s) hoje</p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-700" role="progressbar" aria-valuenow={finished} aria-valuemin={0} aria-valuemax={todayTasks.length || 1} aria-label="Tarefas concluídas hoje"><div className="h-full rounded-full bg-violet-500" style={{ width: `${todayTasks.length ? finished / todayTasks.length * 100 : 0}%` }} /></div>
      <h4 className="mt-5 font-semibold text-violet-200">Suas 3 próximas prioridades</h4>
      {pending.length ? <ol className="mt-2 space-y-2">{pending.slice(0, 3).map(task => <li key={task.id ?? task.title} className="rounded-lg border border-slate-700 p-3 text-sm">{task.title} <span className="text-slate-400">· {task.priority}{task.dueDate && task.dueDate < today ? " · Atrasada" : ""}</span></li>)}</ol> : <p className="mt-2 text-sm text-slate-400">Nenhuma tarefa pendente ou atrasada. Aproveite para planejar o próximo passo.</p>}
      <h4 className="mt-5 font-semibold text-violet-200">Agenda de hoje</h4>
      {appointments.length ? <ul className="mt-2 space-y-2">{appointments.slice(0, 5).map((event, index) => <li key={index} className="text-sm text-slate-300">{new Date(event.startsAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} · {event.title}</li>)}</ul> : <p className="mt-2 text-sm text-slate-400">Sem compromissos na agenda MYRYRA hoje.</p>}
      <div className="mt-5 rounded-xl border border-violet-400/25 bg-violet-500/5 p-4" aria-label="Revisão do dia">
        <h4 className="font-semibold text-violet-200">Revisão do dia</h4>
        <p className="mt-2 text-sm text-slate-300">Você concluiu {finished} de {todayTasks.length} tarefas previstas para hoje. {overdue.length} tarefa(s) estão atrasadas.</p>
        <h5 className="mt-3 text-sm font-medium text-violet-100">Prepare amanhã</h5>
        {tomorrowTasks.length ? <ul className="mt-2 space-y-1 text-sm text-slate-300">{tomorrowTasks.slice(0, 3).map(task => <li key={task.id ?? task.title}>• {task.title}</li>)}</ul> : <p className="mt-2 text-sm text-slate-400">Nenhuma tarefa com prazo amanhã. Aproveite para definir suas prioridades.</p>}
      </div>
      <p className="mt-3 text-xs text-slate-400">Resumo baseado nas tarefas e eventos MYRYRA. Eventos externos do Google ainda não estão incluídos.</p>
    </>}
  </section>;
}
