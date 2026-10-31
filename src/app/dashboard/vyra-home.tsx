"use client";

import { useEffect, useState } from "react";
import { useVyraActiveModule, useVyraNavigation } from "./vyra-module-context";
import { loadVyraMetrics } from "./vyra-metrics-service";
import { getCloudEvents } from "@/lib/event-cloud";
import WhatNowCard from "./what-now-card";
import { getCompletionRate, type VyraMetrics } from "./vyra-metrics";

type HomeEvent = { id: string; title: string; start: string; source: "MYRYRA" | "Google" };

export default function VyraHome() {
  const activeModule = useVyraActiveModule();
  const { navigateTo } = useVyraNavigation();
  const [metrics, setMetrics] = useState<VyraMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAllTools, setShowAllTools] = useState(false);
  const [upcoming, setUpcoming] = useState<HomeEvent[]>([]);
  const [agendaLoading, setAgendaLoading] = useState(true);
  const [agendaError, setAgendaError] = useState(false);
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
    async function loadAgenda() {
      setAgendaLoading(true);
      setAgendaError(false);
      try {
        const [local, googleResponse] = await Promise.all([
          getCloudEvents(),
          fetch("/api/google/events", { cache: "no-store" }),
        ]);
        if (!googleResponse.ok) throw new Error("Agenda externa indisponível");
        const google: { connected: boolean; events?: Array<{ id: string | null; title: string; start: string | null; status?: string | null }> } = await googleResponse.json();
        const now = Date.now();
        const combined: HomeEvent[] = [
          ...local.map((event) => ({ id: event.id, title: event.title, start: event.startsAt, source: "MYRYRA" as const })),
          ...(google.connected ? (google.events ?? []).filter((event) => event.start && event.status !== "cancelled").map((event, index) => ({ id: event.id ?? `google-${index}`, title: event.title, start: event.start!, source: "Google" as const })) : []),
        ];
        const next = combined.filter((event) => {
          const time = new Date(event.start).getTime();
          return Number.isFinite(time) && time >= now;
        }).sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()).slice(0, 3);
        if (!cancelled) setUpcoming(next);
      } catch {
        if (!cancelled) setAgendaError(true);
      } finally {
        if (!cancelled) setAgendaLoading(false);
      }
    }
    void loadAgenda();
    return () => { cancelled = true; };
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
      {/* MYRYRA_GOOGLE_HOME_CARD */}
      {googleStatus === "disconnected" && (
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
      <section className="grid gap-3 lg:grid-cols-2" aria-label="Resumo do dia">
        <div className="min-w-0 rounded-2xl border border-white/10 bg-slate-900/45 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-white">Próximo compromisso</h2>
              <p className="mt-1 text-xs text-slate-400">O que vem a seguir na sua agenda</p>
            </div>
            <button type="button" onClick={() => navigateTo("vyra-calendar")}
              className="shrink-0 text-xs font-semibold text-violet-300 hover:text-white focus-visible:outline-2 focus-visible:outline-violet-400">Ver agenda →</button>
          </div>
          {agendaLoading ? <p role="status" className="mt-5 text-sm text-slate-400">Consultando agenda...</p>
            : agendaError ? <p role="status" className="mt-5 text-sm text-amber-300">Agenda temporariamente indisponível.</p>
            : upcoming.length === 0 ? <p className="mt-5 text-sm text-slate-400">Nenhum próximo compromisso encontrado.</p>
            : <div className="mt-4 flex min-w-0 items-center justify-between gap-3 rounded-xl bg-white/[0.035] px-3 py-3">
                <span className="min-w-0 truncate text-sm font-medium text-white" title={upcoming[0].title}>{upcoming[0].title}</span>
                <span className="shrink-0 text-right text-xs text-slate-400">{new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(upcoming[0].start))}<span className="block text-violet-300">{upcoming[0].source}</span></span>
              </div>}
          {upcoming.length > 1 && !agendaLoading && !agendaError && (
            <p className="mt-2 text-xs text-slate-500">Mais {upcoming.length - 1} compromisso(s) na sequência</p>
          )}
        </div>
        <div className="min-w-0 rounded-2xl border border-white/10 bg-slate-900/45 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-white">Seu progresso</h2>
              <p className="mt-1 text-xs text-slate-400">Um resumo sem distrações</p>
            </div>
            <button type="button" onClick={() => navigateTo("vyra-performance")}
              className="shrink-0 text-xs font-semibold text-violet-300 hover:text-white focus-visible:outline-2 focus-visible:outline-violet-400">Detalhes →</button>
          </div>
          <div className="mt-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-3xl font-semibold tabular-nums text-white">{loading ? "…" : metrics ? `${progress}%` : "—"}</p>
              <p className="mt-1 text-xs text-slate-400">Tarefas concluídas</p>
            </div>
            <div className="text-right text-xs text-slate-400">
              <p><span className="font-semibold text-slate-200">{metrics?.pending ?? "—"}</span> pendentes</p>
              <p className="mt-1"><span className="font-semibold text-slate-200">{metrics?.overdue ?? "—"}</span> atrasadas</p>
            </div>
          </div>
          <div role="progressbar" aria-label="Progresso das tarefas" aria-valuemin={0} aria-valuemax={100}
            aria-valuenow={metrics ? progress : undefined} className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-800">
            <div className="h-full rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-400 transition-all duration-700" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </section>

      <section className="space-y-3" aria-label="Ferramentas principais">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-white">Seu espaço</h2>
            <p className="mt-1 text-xs text-slate-400">Tudo o que você precisa, sem distrações.</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Meu dia", detail: "Agenda e prioridades", icon: "▦", id: "vyra-planner" },
            { label: "Minhas tarefas", detail: "Organize e acompanhe", icon: "✓", id: "vyra-tasks" },
            { label: "Copiloto IA", detail: "Converse com a Myka", icon: "✦", id: "vyra-ai" },
            { label: "Meu progresso", detail: "Resultados e evolução", icon: "◈", id: "vyra-performance" },
          ].map((action) => (
            <button key={action.id} type="button"
              onClick={() => navigateTo(action.id)}
              className="group min-w-0 rounded-2xl border border-white/10 bg-slate-900/55 p-4 text-left transition-colors hover:border-violet-400/40 hover:bg-violet-950/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400 sm:p-5">
              <span className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/15 text-lg text-violet-300" aria-hidden="true">{action.icon}</span>
              <span className="block text-sm font-semibold text-white">{action.label}</span>
              <span className="mt-1 block text-xs text-slate-400">{action.detail}</span>
            </button>
          ))}
        </div>
        <button type="button" aria-expanded={showAllTools} aria-controls="myryra-extra-tools"
          onClick={() => setShowAllTools((value) => !value)}
          className="flex w-full items-center justify-between rounded-xl px-2 py-3 text-left text-sm font-medium text-violet-300 transition hover:bg-violet-500/10 focus-visible:outline-2 focus-visible:outline-violet-400">
          <span>{showAllTools ? "Ocultar ferramentas" : "Todas as ferramentas"}</span>
          <span aria-hidden="true">{showAllTools ? "−" : "+"}</span>
        </button>
        {showAllTools && (
          <div id="myryra-extra-tools" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {[
              { label: "Calendário", id: "vyra-calendar" },
              { label: "AutoPilot", id: "vyra-scheduling" },
              { label: "Configurações", id: "vyra-settings" },
            ].map((action) => (
              <button key={action.id} type="button" onClick={() => navigateTo(action.id)}
                className="rounded-xl border border-white/10 bg-slate-900/50 px-4 py-3 text-left text-xs font-medium text-slate-200 transition hover:border-violet-500/40 hover:text-white focus-visible:outline-2 focus-visible:outline-violet-400">
                {action.label} <span aria-hidden="true" className="text-violet-400">→</span>
              </button>
            ))}
          </div>
        )}
      </section>

      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}    </section>
  );
}
