"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useVyraActiveModule, useVyraNavigation } from "./vyra-module-context";
import { loadVyraMetrics } from "./vyra-metrics-service";
import { getCompletionRate, type VyraMetrics } from "./vyra-metrics";
import { getCloudEvents } from "@/lib/event-cloud";

export default function VyraHome() {
  const activeModule = useVyraActiveModule();
  const { navigateTo, navigateToQuickAction } = useVyraNavigation();
  const [metrics, setMetrics] = useState<VyraMetrics | null>(null);
  const [nextEvent, setNextEvent] = useState<{ title: string; start: string } | null>(null);
  const [agendaError, setAgendaError] = useState(false);
  const [today, setToday] = useState<Date | null>(null);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active) setToday(new Date()); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (activeModule !== "home") return;
    let cancelled = false;
    const refreshMetrics = () => {
      void loadVyraMetrics().then((value) => {
        if (!cancelled) setMetrics(value);
      }).catch(() => { if (!cancelled) setMetrics(null); });
    };
    refreshMetrics();
    window.addEventListener("myryra:tasks-updated", refreshMetrics);
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
    return () => {
      cancelled = true;
      window.removeEventListener("myryra:tasks-updated", refreshMetrics);
    };
  }, [activeModule]);

  if (activeModule !== "home") return null;
  const progress = metrics ? getCompletionRate(metrics) : null;
  const smartSuggestion = !metrics
    ? { message: "Confira suas prioridades e encontre a próxima ação.", action: "Ver prioridades", module: "vyra-tasks" }
    : metrics.overdue > 0
      ? { message: `${metrics.overdue} tarefas precisam da sua atenção.`, action: "Revisar atrasos", module: "vyra-tasks" }
      : metrics.openHighPriority > 0
        ? { message: `${metrics.openHighPriority} prioridades importantes aguardam você.`, action: "Ver prioridades", module: "vyra-tasks" }
        : metrics.pending > 0
          ? { message: `Você tem ${metrics.pending} tarefas para avançar hoje.`, action: "Planejar meu dia", module: "vyra-tasks" }
          : { message: "Suas tarefas estão em dia. Que tal planejar um novo objetivo?", action: "Criar objetivo", module: "vyra-tasks" };

  return (
    <main className="mx-auto flex w-full max-w-2xl min-w-0 flex-col gap-4 pb-4" aria-label="MYRYRA Flow Plus">
      <section className="relative isolate overflow-hidden rounded-[28px] border border-violet-400/15 bg-[#101b30] px-5 pb-5 pt-6 shadow-[0_24px_80px_rgba(0,0,0,.24)] sm:px-7 sm:pt-8" aria-label="Sua experiência Flow">
        <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-violet-500/10 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -left-20 bottom-0 h-40 w-40 rounded-full bg-indigo-500/15 blur-3xl" />
        <div className="relative flex items-center justify-between gap-3">
          <span className="text-[10px] font-bold uppercase tracking-[.24em] text-violet-200">MYRYRA <span className="text-white">FLOW+</span></span>
          <span className="text-xs text-slate-400">{today ? new Intl.DateTimeFormat("pt-BR",{day:"2-digit",month:"short"}).format(today) : "Seu momento"}</span>
        </div>
        <div className="relative mt-7 flex items-start gap-4">
          <div aria-hidden="true" className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] border border-violet-200/30 bg-gradient-to-br from-violet-400/25 via-indigo-400/20 to-fuchsia-400/20 text-3xl text-cyan-100 shadow-[0_0_32px_rgba(34,211,238,.15)]">✦</div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-violet-200">MIKA está com você</p>
            <h1 className="mt-1 text-[25px] font-semibold leading-tight tracking-tight text-white sm:text-3xl">Qual é o seu próximo movimento?</h1>
          </div>
        </div>
        <button type="button" onClick={() => navigateTo("vyra-ai")} className="relative mt-7 flex min-h-16 w-full items-center gap-3 rounded-2xl border border-violet-200/25 bg-white/[.08] px-4 text-left transition hover:border-violet-200/50 hover:bg-white/[.12] focus-visible:outline-2 focus-visible:outline-violet-400">
          <span aria-hidden="true" className="text-xl text-violet-200">✧</span>
          <span className="min-w-0 flex-1 text-sm text-slate-200">Conte à MIKA o que você precisa...</span>
          <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-400 text-lg font-bold text-white">↗</span>
        </button>
        <div className="relative mt-4 grid grid-cols-3 gap-2" aria-label="Comece por aqui">
          <button type="button" onClick={() => navigateToQuickAction?.("capture")} className="min-h-14 rounded-xl border border-white/10 bg-white/[.04] px-2 py-2 text-center text-xs font-medium text-slate-100 hover:bg-white/10">＋<span className="mt-1 block">Criar tarefa</span></button>
          <button type="button" onClick={() => navigateTo("vyra-calendar")} className="min-h-14 rounded-xl border border-white/10 bg-white/[.04] px-2 py-2 text-center text-xs font-medium text-slate-100 hover:bg-white/10">▦<span className="mt-1 block">Minha agenda</span></button>
          <Link href="/journey" className="flex min-h-14 flex-col items-center justify-center rounded-xl border border-white/10 bg-white/[.04] px-2 py-2 text-center text-xs font-medium text-slate-100 hover:bg-white/10">◇<span className="mt-1 block">Evoluir</span></Link>
        </div>
      </section>

      <section className="rounded-[24px] border border-white/10 bg-[#111a2a] p-4 sm:p-5" aria-label="Prioridade do momento">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-bold uppercase tracking-[.2em] text-violet-200">01 / SEU FOCO</p>
          <span className="rounded-full bg-violet-400/10 px-2.5 py-1 text-[10px] text-violet-200">Próxima ação</span>
        </div>
        <p className="mt-3 text-lg font-semibold leading-snug text-white">{smartSuggestion.message}</p>
        <button type="button" onClick={() => navigateTo(smartSuggestion.module)} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-violet-400 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-200 focus-visible:outline-2 focus-visible:outline-white">{smartSuggestion.action} <span aria-hidden="true">↗</span></button>
      </section>

      <section aria-label="Seu dia em um olhar" className="flex items-stretch gap-2">
        <button type="button" onClick={() => navigateTo("vyra-calendar")} className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-white/[.035] px-3 py-3 text-left hover:bg-white/[.07]">
          <span className="block text-[11px] text-slate-400">Próximo evento</span>
          <span className="mt-1 block truncate text-sm font-semibold text-white">{nextEvent ? nextEvent.title : agendaError ? "Indisponível" : "Agenda livre"}</span>
          {nextEvent && <span className="block text-[11px] text-violet-200">{new Intl.DateTimeFormat("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}).format(new Date(nextEvent.start))}</span>}
        </button>
        <button type="button" onClick={() => navigateTo("vyra-tasks")} className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-white/[.035] px-3 py-3 text-left hover:bg-white/[.07]">
          <span className="block text-[11px] text-slate-400">Seu ritmo</span>
          <span className="mt-1 block text-sm font-semibold text-white">{progress === null ? "—" : `${progress}% concluído`}</span>
          <span className="block text-[11px] text-slate-400">{metrics?.pending ?? "—"} pendentes</span>
        </button>
      </section>
    </main>
  );
}
