"use client";

import { useState } from "react";

type Plan = {
  pendingTasks: number;
  overdueTasks: number;
  todayEvents: number;
  conflicts: { first: string; second: string }[];
  priorities: { title: string; priority: string; dueDate: string | null }[];
  freeSlots: { startsAt: string; endsAt: string; minutes: number }[];
};

function localIso(date: Date) {
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  const hh = String(Math.floor(Math.abs(offset) / 60)).padStart(2, "0");
  const mm = String(Math.abs(offset) % 60).padStart(2, "0");
  const local = new Date(date.getTime() + offset * 60000).toISOString().slice(0, 19);
  return `${local}${sign}${hh}:${mm}`;
}

export default function MikaResolveMyDay() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function prepare() {
    setLoading(true); setError(""); setPlan(null);
    try {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const end = new Date(start); end.setDate(end.getDate() + 1);
      const response = await fetch("/api/mika/daily-plan", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dayStart: localIso(start), dayEnd: localIso(end) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível preparar seu dia.");
      setPlan(result.plan);
    } catch (err) { setError(err instanceof Error ? err.message : "Falha ao consultar o planejamento."); }
    finally { setLoading(false); }
  }
  const formatTime = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return (
    <section className="rounded-2xl border border-violet-400/30 bg-gradient-to-br from-violet-950/50 to-slate-950 p-4 sm:p-5" aria-label="MIKA resolva meu dia">
      <div className="flex items-center gap-3">
        <img src="/myka-transparente.png" alt="" className="h-12 w-12 object-contain" />
        <div><h3 className="font-semibold text-white">MIKA, resolva meu dia</h3><p className="text-sm text-slate-300">Prioridades, conflitos e horários livres em um só lugar.</p></div>
      </div>
      <button type="button" onClick={prepare} disabled={loading} className="mt-4 rounded-xl bg-violet-500 px-4 py-2 font-semibold text-white disabled:opacity-50">
        {loading ? "Analisando seu dia..." : "Organizar meu dia"}
      </button>
      {error && <p role="alert" className="mt-3 text-sm text-rose-300">{error}</p>}
      {plan && <div className="mt-4 space-y-3 text-sm text-slate-200" aria-live="polite">
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-white/10 p-3"><strong className="block text-xl">{plan.pendingTasks}</strong>Tarefas pendentes</div>
          <div className="rounded-lg bg-white/10 p-3"><strong className="block text-xl">{plan.todayEvents}</strong>Compromissos</div>
          <div className="rounded-lg bg-white/10 p-3"><strong className="block text-xl">{plan.overdueTasks}</strong>Atrasadas</div>
        </div>
        <div><h4 className="font-semibold text-white">Suas prioridades</h4>
          {plan.priorities.length ? <ul className="mt-1 list-inside list-disc">{plan.priorities.map((task, i) => <li key={i}>{task.title} ({task.priority})</li>)}</ul> : <p>Sem tarefas pendentes.</p>}
        </div>
        <div><h4 className="font-semibold text-white">Horários livres</h4>
          {plan.freeSlots.length ? <ul className="mt-1 list-inside list-disc">{plan.freeSlots.slice(0, 3).map((slot, i) => <li key={i}>{formatTime(slot.startsAt)}–{formatTime(slot.endsAt)} ({slot.minutes} min)</li>)}</ul> : <p>Nenhum intervalo livre identificado no restante do dia.</p>}
        </div>
        {plan.conflicts.length > 0 && <p className="text-amber-200">{plan.conflicts.length} conflito(s) entre compromissos. Revise sua agenda.</p>}
        <p className="text-xs text-slate-400">Análise somente de leitura. Nenhuma tarefa ou compromisso foi alterado. A execução assistida exigirá aprovação.</p>
      </div>}
    </section>
  );
}
