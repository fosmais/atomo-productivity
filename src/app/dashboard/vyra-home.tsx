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
  // MYRYRA_GOOGLE_HOME_CARD
  const [googleStatus, setGoogleStatus] = useState<"loading" | "connected" | "disconnected" | "error">("loading");

  useEffect(() => {
    if (activeModule !== "home") return;

    let cancelled = false;

    async function checkGoogleConnection() {
      setGoogleStatus("loading");

      try {
        const response = await fetch("/api/google/events", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Falha ao verificar conexão Google.");
        }

        const result: { connected?: boolean } = await response.json();

        if (!cancelled) {
          setGoogleStatus(result.connected ? "connected" : "disconnected");
        }
      } catch {
        if (!cancelled) setGoogleStatus("error");
      }
    }

    void checkGoogleConnection();

    return () => {
      cancelled = true;
    };
  }, [activeModule]);

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
      {/* MYRYRA_GOOGLE_HOME_CARD */}
      {googleStatus !== "connected" && (
        <section className="rounded-2xl border border-violet-500/25 bg-gradient-to-r from-violet-950/40 to-slate-900/70 p-5 md:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-violet-400">
                Integração Google Calendar
              </p>
              <h2 className="mt-2 text-lg font-semibold text-white">
                {googleStatus === "error"
                  ? "Verifique sua conexão com o Google Calendar"
                  : "Sua agenda em sintonia com a MYRYRA"}
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-400">
                {googleStatus === "error"
                  ? "Não foi possível verificar sua integração. Você pode tentar novamente ou conectar sua agenda."
                  : "Conecte seu Google Calendar para sincronizar compromissos e receber sugestões inteligentes da Myka."}
              </p>
            </div>

            <a
              href="/api/google/connect"
              className="inline-flex shrink-0 items-center justify-center rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-violet-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400"
            >
              {googleStatus === "loading"
                ? "Conectar Google Calendar"
                : googleStatus === "error"
                  ? "Conectar ou reconectar"
                  : "Conectar Google Calendar"}
            </a>
          </div>
        </section>
      )}
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
