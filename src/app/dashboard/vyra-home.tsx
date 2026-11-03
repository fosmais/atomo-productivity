"use client";

import { useEffect, useState } from "react";
import { useVyraActiveModule, useVyraNavigation } from "./vyra-module-context";
import { loadVyraMetrics } from "./vyra-metrics-service";
import { getCompletionRate, type VyraMetrics } from "./vyra-metrics";
import { getCloudEvents } from "@/lib/event-cloud";
import WhatNowCard from "./what-now-card";

const shortcuts = [
  { label: "Agenda", icon: "▦", module: "vyra-calendar" },
  { label: "Tarefas", icon: "✓", module: "vyra-tasks" },
  { label: "Lembretes", icon: "◷", module: "vyra-tasks" },
  { label: "Financeiro", icon: "◇", module: "vyra-finance" },
  { label: "Metas", icon: "◎", module: "vyra-tasks" },
  { label: "MIKA", icon: "✦", module: "vyra-ai" },
];

export default function VyraHome() {
  const activeModule = useVyraActiveModule();
  const { navigateTo } = useVyraNavigation();
  const [metrics, setMetrics] = useState<VyraMetrics | null>(null);
  const [nextEvent, setNextEvent] = useState<{ title: string; start: string } | null>(null);
  const [agendaError, setAgendaError] = useState(false);

  useEffect(() => {
    if (activeModule !== "home") return;
    let cancelled = false;
    void loadVyraMetrics().then((value) => {
      if (!cancelled) setMetrics(value);
    }).catch(() => { if (!cancelled) setMetrics(null); });
    async function loadAgenda() {
      try {
        const [localResult, googleResult] = await Promise.allSettled([
          getCloudEvents(),
          fetch("/api/google/events", { cache: "no-store" }),
        ]);
        const local = localResult.status === "fulfilled" ? localResult.value : [];
        const google = googleResult.status === "fulfilled" && googleResult.value.ok
          ? await googleResult.value.json().catch(() => ({ connected: false, events: [] }))
          : { connected: false, events: [] };
        if (localResult.status === "rejected" && !google.connected) throw new Error("Agenda indisponível");
        const events = [
          ...local.map((event) => ({ title: event.title, start: event.startsAt })),
          ...(google.connected ? (google.events ?? []).filter((event: { start?: string | null; status?: string }) => event.start && event.status !== "cancelled").map((event: { title: string; start: string }) => ({ title: event.title, start: event.start })) : []),
        ].filter((event) => new Date(event.start).getTime() >= Date.now())
          .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
        if (!cancelled) setNextEvent(events[0] ?? null);
      } catch {
        if (!cancelled) setAgendaError(true);
      }
    }
    void loadAgenda();
    return () => { cancelled = true; };
  }, [activeModule]);

  if (activeModule !== "home") return null;
  const progress = metrics ? getCompletionRate(metrics) : null;

  return (
    <main className="flex min-w-0 flex-col gap-3 lg:max-h-[calc(100dvh-210px)] lg:overflow-y-auto" aria-label="Início MYRYRA">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-300">MYRYRA · HOJE</p>
          <h1 className="text-xl font-semibold text-white sm:text-2xl">Seu dia, do seu jeito.</h1>
        </div>
        <button type="button" onClick={() => navigateTo("vyra-ai")} className="rounded-xl border border-violet-400/40 bg-violet-500/15 px-3 py-2 text-xs font-semibold text-violet-100 hover:bg-violet-500/25">✦ Pergunte à MIKA</button>
      </div>

      <section className="rounded-2xl border border-violet-400/25 bg-gradient-to-br from-violet-950/45 to-slate-900/70 p-3 sm:p-4" aria-label="O que precisa fazer">
        <h2 className="mb-3 text-sm font-semibold text-white">O que precisa fazer?</h2>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Nova tarefa", icon: "+", module: "vyra-tasks" },
            { label: "Agendar", icon: "▦", module: "vyra-calendar" },
            { label: "Lembrete", icon: "◷", module: "vyra-tasks" },
          ].map((item) => (
            <button key={item.label} type="button" onClick={() => navigateTo(item.module)}
              className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border border-white/10 bg-white/5 px-2 py-2 text-xs font-medium text-white transition hover:border-violet-400/60 hover:bg-violet-500/15 focus-visible:outline-2 focus-visible:outline-violet-400">
              <span className="text-xl text-violet-200" aria-hidden="true">{item.icon}</span>{item.label}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-slate-900/55 p-3 sm:p-4" aria-label="Menu rápido">
        <h2 className="mb-3 text-sm font-semibold text-white">O que quer acessar?</h2>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {shortcuts.map((item) => (
            <button key={item.label} type="button" onClick={() => navigateTo(item.module)}
              className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border border-white/10 bg-slate-950/60 px-2 py-2 text-xs font-medium text-slate-100 transition hover:border-violet-400/60 hover:bg-violet-500/15 focus-visible:outline-2 focus-visible:outline-violet-400">
              <span className="text-xl text-violet-300" aria-hidden="true">{item.icon}</span>{item.label}
            </button>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2 text-xs" aria-label="Resumo rápido">
        <button type="button" onClick={() => navigateTo("vyra-calendar")} className="min-w-0 rounded-xl border border-white/10 bg-slate-900/50 p-3 text-left hover:border-violet-400/50">
          <span className="block text-slate-400">Próximo compromisso</span>
          <span className="mt-1 block truncate font-semibold text-white">{nextEvent ? nextEvent.title : agendaError ? "Agenda indisponível" : "Nenhum compromisso"}</span>
          {nextEvent && <span className="mt-1 block text-violet-300">{new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(nextEvent.start))}</span>}
        </button>
        <button type="button" onClick={() => navigateTo("vyra-performance")} className="rounded-xl border border-white/10 bg-slate-900/50 p-3 text-left hover:border-violet-400/50">
          <span className="block text-slate-400">Seu progresso</span>
          <span className="mt-1 block text-lg font-semibold text-white">{progress === null ? "—" : `${progress}%`}</span>
          <span className="block text-slate-400">{metrics?.pending ?? "—"} pendentes</span>
        </button>
      </section>

      <details className="rounded-xl border border-white/10 bg-slate-900/35 px-3 py-2">
        <summary className="cursor-pointer text-xs font-semibold text-violet-200">✦ Sugestão inteligente · O que fazer agora?</summary>
        <div className="mt-3"><WhatNowCard /></div>
      </details>
    </main>
  );
}
