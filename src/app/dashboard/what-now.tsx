"use client";

import { useState } from "react";
import { getCloudPlans } from "@/lib/plan-cloud";
import { getCloudAvailability } from "@/lib/cloud-availability";
import { getCloudTasksForScheduling } from "@/lib/cloud-task-scheduling";

type Candidate = { id: string | null; title: string; priority: string; dueDate: string | null; duration: number | null; score: number };
type Suggestion = { task: Candidate; freeMinutes: number; availableUntil: Date | null; fits: boolean };

function rank(task: Omit<Candidate, "score">): number {
  const priority = task.priority === "Alta" ? 30 : task.priority === "Média" ? 20 : 10;
  if (!task.dueDate) return priority;
  const due = new Date(task.dueDate.slice(0, 10) + "T12:00:00");
  if (Number.isNaN(due.getTime())) return priority;
  const today = new Date();
  const todayLocal = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12);
  const days = Math.round((due.getTime() - todayLocal.getTime()) / 86400000);
  return priority + (days < 0 ? 40 : days <= 1 ? 25 : days <= 3 ? 15 : 0);
}

export default function WhatNow() {
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [error, setError] = useState("");

  async function recommend() {
    setLoading(true);
    setError("");
    setSuggestion(null);
    try {
      const [plans, availability, scheduling] = await Promise.all([
        getCloudPlans(), getCloudAvailability(new Date(), 1), getCloudTasksForScheduling(),
      ]);
      const durationById = new Map(scheduling.ready.map((task) => [task.id, task.durationMinutes]));
      const pending: Candidate[] = plans.flatMap((plan) => plan.tasks)
        .filter((task) => !task.completed)
        .map((task) => {
          const base = { id: task.id ?? null, title: task.title, priority: task.priority,
            dueDate: task.dueDate, duration: task.id ? durationById.get(task.id) ?? null : null };
          return { ...base, score: rank(base) };
        });
      if (!pending.length) {
        setError("Nenhuma tarefa pendente encontrada nos planos salvos.");
        return;
      }
      const now = new Date();
      const slots = availability.flatMap((day) => day.available)
        .map((interval) => ({ start: new Date(Math.max(interval.start.getTime(), now.getTime())), end: interval.end }))
        .filter((interval) => interval.end.getTime() > interval.start.getTime())
        .sort((a, b) => a.start.getTime() - b.start.getTime());
      const active = slots.find((slot) => slot.start.getTime() <= now.getTime() && slot.end.getTime() > now.getTime());
      const freeMinutes = active ? Math.floor((active.end.getTime() - now.getTime()) / 60000) : 0;
      const sorted = pending.sort((a, b) => b.score - a.score);
      const fitting = active ? sorted.find((task) => task.duration !== null && task.duration <= freeMinutes) : undefined;
      const task = fitting ?? sorted[0];
      setSuggestion({ task, freeMinutes, availableUntil: active?.end ?? null,
        fits: Boolean(fitting) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível analisar suas prioridades.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-xl border border-violet-500/30 bg-slate-900 p-5 text-white">
      <p className="text-xs font-semibold uppercase tracking-widest text-violet-400">MYRYRA · WHAT NOW? 2.0</p>
      <h3 className="mt-2 text-xl font-semibold">Qual é o próximo passo?</h3>
      <p className="mt-2 text-sm text-slate-300">Recomendação por prioridade, prazo, duração e disponibilidade MYRYRA. Nenhuma tarefa é iniciada automaticamente.</p>
      <button type="button" onClick={() => void recommend()} disabled={loading}
        className="mt-4 rounded-lg bg-violet-600 px-4 py-2 font-semibold hover:bg-violet-500 disabled:opacity-50">
        {loading ? "Analisando..." : "O que fazer agora?"}
      </button>
      {error && <p role="status" className="mt-3 text-sm text-amber-300">{error}</p>}
      {suggestion && (
        <div className="mt-4 rounded-lg border border-slate-700 bg-slate-800 p-4">
          <p className="text-xs text-violet-300">{suggestion.fits ? "Tarefa que cabe no tempo disponível" : "Sua maior prioridade pendente"}</p>
          <p className="mt-2 font-semibold">{suggestion.task.title}</p>
          <p className="mt-1 text-sm text-slate-300">
            Prioridade: {suggestion.task.priority}
            {suggestion.task.dueDate ? " · Prazo: " + suggestion.task.dueDate.slice(0, 10) : " · Sem prazo"}
            {suggestion.task.duration ? ` · Duração: ${suggestion.task.duration} min` : " · Duração não informada"}
          </p>
          <p className="mt-2 text-sm text-violet-200">
            {suggestion.availableUntil ? `${suggestion.freeMinutes} min livres agora, até ${suggestion.availableUntil.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}.` :
              "Nenhuma janela livre de planejamento neste momento."}
          </p>
          {!suggestion.fits && <p className="mt-2 text-xs text-amber-200">Não foi possível confirmar uma tarefa que caiba agora. Ajuste a duração ou consulte o Smart Scheduling.</p>}
          <p className="mt-2 text-xs text-slate-400">Considera apenas eventos bloqueantes MYRYRA; Google Calendar não é consultado nesta recomendação.</p>
        </div>
      )}
    </section>
  );
}
