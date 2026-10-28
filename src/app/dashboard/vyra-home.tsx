"use client";

import { useEffect, useState } from "react";
import { useVyraActiveModule, useVyraNavigation } from "./vyra-module-context";
import { loadVyraMetrics } from "./vyra-metrics-service";
import WhatNowCard from "./what-now-card";
import { getCompletionRate, type VyraMetrics } from "./vyra-metrics";

export default function VyraHome() {
  const activeModule = useVyraActiveModule();
  const { navigateTo } = useVyraNavigation();
  const [metrics, setMetrics] = useState<VyraMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (activeModule !== "home") return;

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const result = await loadVyraMetrics();
        if (!cancelled) setMetrics(result);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Não foi possível carregar seus indicadores."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [activeModule]);

  if (activeModule !== "home") return null;

  const progress = metrics ? getCompletionRate(metrics) : 0;

  const cards = [
    { label: "Pendentes", value: metrics?.pending, symbol: "◷" },
    { label: "Concluídas", value: metrics?.completed, symbol: "✓" },
    { label: "Atrasadas", value: metrics?.overdue, symbol: "!" },
    { label: "Progresso", value: metrics ? `${progress}%` : undefined, symbol: "◈" },
  ];

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-2 py-2 md:py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-400">
          MYRYRA · FOCUS FIRST
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
          Seu dia, em sintonia.
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-slate-400">
          Priorize o que importa. A MYRYRA ajuda você a decidir o próximo passo.
        </p>
      </div>
      <WhatNowCard />

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-white">
            Visão geral
          </h2>
          <span className="text-xs text-slate-500">
            Suas tarefas
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {cards.map((card) => (
            <div
              key={card.label}
              className="min-w-0 rounded-2xl border border-white/10 bg-slate-900/60 p-4 transition-colors hover:border-violet-500/30"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-slate-400">
                  {card.label}
                </span>
                <span
                  className="text-base text-violet-400"
                  aria-hidden="true"
                >
                  {card.symbol}
                </span>
              </div>

              <p className="mt-2 text-2xl font-semibold tracking-tight text-white tabular-nums md:text-3xl">
                {loading ? (
                  <span
                    className="block h-8 w-14 animate-pulse rounded-lg bg-slate-700/60"
                    role="status"
                    aria-label="Carregando indicador"
                  />
                ) : (
                  card.value ?? "—"
                )}
              </p>

              {card.label === "Progresso" && (
                <div
                  role="progressbar"
                  aria-label="Progresso das tarefas"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={metrics ? progress : undefined}
                  className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-800"
                >
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-400 transition-all duration-700"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-white">
            Acesso rápido
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Continue de onde parou
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
          {[
            { label: "Myka AI", icon: "✦", id: "vyra-ai" },
            { label: "Planner", icon: "◷", id: "vyra-planner" },
            { label: "Tarefas", icon: "✓", id: "vyra-tasks" },
            { label: "Agenda", icon: "▦", id: "vyra-calendar" },
          ].map((action) => (
            <button
              key={action.id}
              type="button"
              onClick={() => {
                navigateTo(action.id);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="group flex min-w-0 items-center justify-between gap-2 rounded-xl border border-white/10 bg-slate-900/40 px-4 py-3 text-left transition-colors hover:border-violet-500/40 hover:bg-violet-950/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="text-lg text-violet-400" aria-hidden="true">
                  {action.icon}
                </span>
                <span className="truncate text-xs font-medium text-slate-200">
                  {action.label}
                </span>
              </span>
              <span
                className="text-xs text-slate-500 transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              >
                →
              </span>
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}    </section>
  );
}
