"use client";

import { useCallback, useEffect, useState } from "react";
import { useVyraNavigation } from "./vyra-module-context";
import {
  getWhatNowRecommendation,
  type WhatNowResult,
} from "@/lib/what-now-service";

export default function WhatNowCard() {
  const { navigateToTask } = useVyraNavigation();
  const [data, setData] = useState<WhatNowResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setData(null);

    try {
      const result = await getWhatNowRecommendation();
      setData(result);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível calcular sua próxima ação."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const recommendation = data?.recommendation;

  return (
    <section className="rounded-3xl border border-violet-400/25 bg-gradient-to-br from-violet-950/65 via-[#15112e] to-slate-950 p-5 shadow-[0_20px_70px_-35px_rgba(124,58,237,0.55)] sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-400">
            ✦ MYKA · WHAT NOW?
          </p>

          <h2 className="mt-2 text-2xl font-semibold text-white">
            O que vale a pena fazer agora?
          </h2>

          <p className="mt-2 text-sm text-slate-400">
            Uma sugestão prática com base nas suas tarefas e na sua disponibilidade.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="rounded-xl border border-violet-400/30 px-4 py-2 text-sm font-medium text-violet-200 transition hover:bg-violet-500/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400 motion-reduce:transition-none disabled:opacity-50"
        >
          {loading ? "Analisando..." : "Atualizar"}
        </button>
      </div>

      <div className="mt-6">
        {loading ? (
          <div role="status" aria-live="polite" className="flex items-center gap-3 rounded-2xl border border-violet-400/15 bg-slate-950/40 p-5">
            <span
              aria-hidden="true"
              className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-violet-400/20 border-t-violet-400 motion-reduce:animate-none"
            />
            <p className="text-sm text-slate-300">
              Analisando suas tarefas e sua agenda...
            </p>
          </div>
        ) : error ? (
          <div role="alert" className="space-y-2">
            <p className="text-sm text-amber-300">
              Não foi possível verificar sua disponibilidade.
            </p>
            <p className="text-xs text-slate-400">{error}</p>
          </div>
        ) : recommendation ? (
          <div className="rounded-2xl border border-violet-400/15 bg-white/[0.045] p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-violet-300">
              SUA PRÓXIMA AÇÃO
            </p>

            <h3 className="mt-3 text-xl font-semibold text-white">
              {recommendation.title}
            </h3>

            <p className="mt-3 text-sm text-slate-300">
              {recommendation.reason}
            </p>

            <div className="mt-5 flex flex-wrap gap-3 text-sm">
              <span className="rounded-full bg-violet-500/15 px-3 py-1.5 text-violet-200">
                {recommendation.durationMinutes} minutos
              </span>

              <span className="rounded-full bg-white/5 px-3 py-1.5 text-slate-300">
                Prioridade {recommendation.priority}
              </span>
            </div>

            <div className="mt-6">
              <button
                type="button"
                onClick={() => {
                  if (navigateToTask) {
                    navigateToTask(recommendation.taskId);
                  }
                }}
                disabled={!navigateToTask}
                className="rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400 motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-50"
              >
                Ir para esta tarefa →
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-5">
            <p className="font-medium text-white">
              Nenhuma tarefa disponível para começar agora.
            </p>

            <p className="mt-2 text-sm text-slate-400">
              Verifique seus horários livres e a duração das tarefas.
            </p>
          </div>
        )}
      </div>

      {!loading && !error && data && data.missingDurationCount > 0 && (
        <p className="mt-4 text-xs text-slate-400">
          {data.missingDurationCount} tarefa(s) precisam de duração
          para participar das recomendações.
        </p>
      )}
    </section>
  );
}