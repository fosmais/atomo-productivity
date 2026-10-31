"use client";
import FeatureHint from "./feature-hint";

import { useCallback, useEffect, useState } from "react";
import { loadVyraCompletionHistory } from "./vyra-metrics-service";
import { calculatePeriodMetrics, getHistoryCoverage } from "./vyra-period-metrics";

type Summary = { completed: number; previous: number; overdue: number; coverage: string };

export default function WeeklyIntelligence() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const tasks = await loadVyraCompletionHistory();
      const now = new Date();
      const metrics = calculatePeriodMetrics(tasks, "week", now);
      const today = now.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
      const overdue = tasks.filter((task) =>
        task.status !== "done" && task.due_date && task.due_date.slice(0, 10) < today
      ).length;
      const coverage = getHistoryCoverage("week", -1, now);
      setSummary({ completed: metrics.current, previous: metrics.previous, overdue, coverage });
    } catch (err) {
      setSummary(null);
      setError(err instanceof Error ? err.message : "Não foi possível carregar a análise semanal.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <section className="rounded-2xl border border-violet-500/30 bg-slate-900 p-5 text-white" aria-label="Inteligência semanal">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <FeatureHint label="MYRYRA · WEEKLY INTELLIGENCE" title="Sua semana em perspectiva" description="Ajuda a acompanhar a evolução das tarefas e identificar padrões de produtividade." tip="Use os indicadores para ajustar seu planejamento." />
          <h3 className="mt-1 text-xl font-semibold">Sua semana em perspectiva.</h3>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading}
          className="rounded-lg border border-slate-700 px-3 py-2 text-sm disabled:opacity-50">
          {loading ? "Atualizando..." : "Atualizar"}
        </button>
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-rose-300">{error}</p>}
      {summary && (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
              ["Concluídas nesta semana", summary.completed],
              ["Semana anterior", summary.coverage === "unavailable" ? "Sem histórico" : summary.previous],
              ["Tarefas atrasadas", summary.overdue],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-slate-700 bg-slate-950 p-3">
                <p className="text-xs text-slate-400">{label}</p>
                <p className="mt-1 text-xl font-semibold text-violet-200">{value}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-sm text-slate-300">
            {summary.coverage === "unavailable" ? "Ainda não há histórico confiável para comparar semanas." :
              summary.completed > summary.previous ? "Você concluiu mais tarefas do que na semana anterior." :
              summary.completed < summary.previous ? "Você concluiu menos tarefas do que na semana anterior." :
              "Seu volume de conclusões está igual ao da semana anterior."}
          </p>
          {summary.coverage === "partial" && <p className="mt-2 text-xs text-amber-200">A semana anterior possui histórico parcial; a comparação pode estar incompleta.</p>}
          <p className="mt-2 text-xs text-slate-400">Semana de segunda a domingo, fuso São Paulo. Atrasos representam o total atual de tarefas vencidas.</p>
        </>
      )}
    </section>
  );
}
