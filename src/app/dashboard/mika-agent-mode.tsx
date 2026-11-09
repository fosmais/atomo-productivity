"use client";

import { useState } from "react";

type Briefing = { pendingTasks: number; todayEvents: number; overdueTasks: number; priorities: { title: string }[]; focusSuggestion: { title: string } | null };

function localIso(date: Date) {
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  const hh = String(Math.floor(Math.abs(offset) / 60)).padStart(2, "0");
  const mm = String(Math.abs(offset) % 60).padStart(2, "0");
  return new Date(date.getTime() + offset * 60000).toISOString().slice(0, 19) + sign + hh + ":" + mm;
}

export default function MikaAgentMode() {
  const [plan, setPlan] = useState<Briefing | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function analyze() {
    setBusy(true); setError(""); setPlan(null);
    try {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const end = new Date(start); end.setDate(end.getDate() + 1);
      const response = await fetch("/api/mika/daily-plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dayStart: localIso(start), dayEnd: localIso(end) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível analisar seu dia.");
      setPlan(data.plan);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Erro ao analisar."); }
    finally { setBusy(false); }
  }
  return <div className="space-y-3 rounded-xl border border-violet-400/30 bg-violet-950/20 p-4" aria-label="MIKA Agente em modo de análise">
    <div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-white">MIKA Agente</strong><span className="rounded-full bg-violet-400/20 px-3 py-1 text-xs text-violet-200">Modo análise · sem ações automáticas</span></div>
    <p className="text-sm text-slate-300">Sou a mesma MIKA, agora ajudando a identificar prioridades e oportunidades no seu dia. Não altero tarefas ou compromissos neste modo.</p>
    <button type="button" onClick={analyze} disabled={busy} className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{busy ? "Analisando..." : "MIKA, organize meu dia"}</button>
    {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
    {plan && <div aria-live="polite" className="space-y-2 text-sm text-slate-200"><p>{plan.pendingTasks} tarefas pendentes · {plan.todayEvents} compromissos · {plan.overdueTasks} tarefas atrasadas</p>{plan.priorities.length > 0 && <p>Prioridades: {plan.priorities.map(p => p.title).join("; ")}</p>}{plan.focusSuggestion && <p>Sugestão de foco: {plan.focusSuggestion.title}</p>}<p className="text-xs text-violet-200">Somente sugestões. Nenhuma ação foi executada.</p></div>}
  </div>;
}
