"use client";

import { useState } from "react";
import { getCloudPlans } from "@/lib/plan-cloud";

type Candidate = { title: string; priority: string; dueDate: string | null };

function score(task: Candidate): number {
  const priority = task.priority === "Alta" ? 30 : task.priority === "Média" ? 20 : 10;
  if (!task.dueDate) return priority;
  const deadline = new Date(task.dueDate.slice(0, 10) + "T12:00:00");
  if (Number.isNaN(deadline.getTime())) return priority;
  const days = Math.ceil((deadline.getTime() - Date.now()) / 86400000);
  return priority + (days < 0 ? 40 : days <= 1 ? 25 : days <= 3 ? 15 : 0);
}

export default function WhatNow() {
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<Candidate | null>(null);
  const [error, setError] = useState("");

  async function recommend() {
    setLoading(true);
    setError("");
    setSuggestion(null);
    try {
      const plans = await getCloudPlans();
      const pending: Candidate[] = plans.flatMap((plan) =>
        plan.tasks.filter((task) => !task.completed).map((task) => ({
          title: task.title,
          priority: task.priority,
          dueDate: task.dueDate,
        }))
      );
      pending.sort((a, b) => score(b) - score(a));
      setSuggestion(pending[0] ?? null);
      if (!pending.length) setError("Nenhuma tarefa pendente encontrada nos planos salvos.");
    } catch {
      setError("Não foi possível consultar os planos. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-xl border border-violet-500/30 bg-slate-900 p-5 text-white">
      <p className="text-xs font-semibold uppercase tracking-widest text-violet-400">MYRYRA · WHAT NOW?</p>
      <h3 className="mt-2 text-xl font-semibold">Qual é o próximo passo?</h3>
      <p className="mt-2 text-sm text-slate-300">Sugestão baseada nas tarefas pendentes, prioridade e prazo. Não altera sua agenda.</p>
      <button type="button" onClick={recommend} disabled={loading}
        className="mt-4 rounded-lg bg-violet-600 px-4 py-2 font-semibold hover:bg-violet-500 disabled:opacity-50">
        {loading ? "Analisando..." : "O que fazer agora?"}
      </button>
      {error && <p role="status" className="mt-3 text-sm text-amber-300">{error}</p>}
      {suggestion && (
        <div className="mt-4 rounded-lg border border-slate-700 bg-slate-800 p-4">
          <p className="text-xs text-violet-300">Próxima tarefa sugerida</p>
          <p className="mt-2 font-semibold">{suggestion.title}</p>
          <p className="mt-1 text-sm text-slate-300">
            Prioridade: {suggestion.priority}
            {suggestion.dueDate ? " · Prazo: " + suggestion.dueDate.slice(0, 10) : " · Sem prazo definido"}
          </p>
          <p className="mt-2 text-xs text-slate-400">A duração e a disponibilidade da agenda ainda não foram verificadas. Confirme antes de iniciar.</p>
        </div>
      )}
    </section>
  );
}
