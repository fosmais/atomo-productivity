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
      ? { message: `Você tem ${metrics.overdue} tarefa(s) atrasada(s). Que tal reorganizar os prazos?`, action: "Revisar atrasos", module: "vyra-tasks" }
      : metrics.openHighPriority > 0
        ? { message: `Há ${metrics.openHighPriority} prioridade(s) alta(s) em aberto. Escolha por onde começar.`, action: "Ver prioridades", module: "vyra-tasks" }
        : metrics.pending > 0
          ? { message: `Você tem ${metrics.pending} tarefa(s) pendente(s). Vamos escolher o próximo passo?`, action: "Planejar meu dia", module: "vyra-tasks" }
          : { message: "Suas tarefas estão em dia. Que tal planejar um novo objetivo?", action: "Criar objetivo", module: "vyra-tasks" };

  return (
    <main className="mx-auto flex w-full max-w-3xl min-w-0 flex-col gap-3" aria-label="Início MYRYRA Pulse">
      <section className="relative overflow-hidden rounded-3xl border border-violet-400/25 bg-gradient-to-br from-violet-950/80 via-slate-900 to-slate-950 px-4 py-6 sm:px-7 sm:py-8">
        <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-fuchsia-600/10 blur-3xl" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-violet-300">✦ MYRYRA PULSE {today ? "· " + new Intl.DateTimeFormat("pt-BR", {day:"numeric",month:"short"}).format(today) : ""}</p>
        <h1 className="mt-3 text-2xl font-semibold leading-tight text-white sm:text-3xl">O que vamos resolver agora?</h1>
        <p className="mt-2 text-sm text-slate-300">A MIKA encontra o melhor caminho para você.</p>
        <button type="button" onClick={() => navigateTo("vyra-ai")} className="mt-5 flex w-full items-center gap-3 rounded-2xl border border-violet-400/40 bg-violet-500/15 px-4 py-4 text-left transition hover:bg-violet-500/25 focus-visible:outline-2 focus-visible:outline-violet-400">
          <span className="text-2xl text-violet-200" aria-hidden="true">✦</span>
          <span className="flex-1 text-sm font-medium text-white">Conversar com a MIKA...</span>
          <span className="text-violet-200" aria-hidden="true">↗</span>
        </button>
        <div className="mt-3 flex flex-wrap gap-2" aria-label="Ações rápidas">
          <button type="button" onClick={() => navigateToQuickAction?.("capture")} className="rounded-full border border-white/15 bg-white/5 px-3 py-2 text-xs text-slate-100 hover:bg-white/10">＋ Nova tarefa</button>
          <button type="button" onClick={() => navigateTo("vyra-calendar")} className="rounded-full border border-white/15 bg-white/5 px-3 py-2 text-xs text-slate-100 hover:bg-white/10">▦ Agenda</button>
          <Link href="/journey" className="rounded-full border border-white/15 bg-white/5 px-3 py-2 text-xs text-slate-100 hover:bg-white/10">◇ Minha jornada</Link>
        </div>
      </section>

      <section aria-label="Seu próximo passo" className="rounded-2xl border border-violet-400/25 bg-slate-900/75 p-4">
        <div className="flex items-start gap-3">
          <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-600/25 text-xl text-violet-200">✦</span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-violet-300">Seu próximo passo</p>
            <p className="mt-1 text-sm leading-relaxed text-white">{smartSuggestion.message}</p>
            <button type="button" onClick={() => navigateTo(smartSuggestion.module)} className="mt-3 text-sm font-semibold text-violet-200 underline-offset-4 hover:underline">{smartSuggestion.action} →</button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2" aria-label="Seu dia em um olhar">
        <button type="button" onClick={() => navigateTo("vyra-calendar")} className="min-w-0 rounded-2xl border border-white/10 bg-slate-900/55 p-3 text-left hover:border-violet-400/50">
          <span className="block text-xs text-slate-400">Próximo evento</span>
          <span className="mt-1 block truncate text-sm font-semibold text-white">{nextEvent ? nextEvent.title : agendaError ? "Indisponível" : "Agenda livre"}</span>
          {nextEvent && <span className="mt-1 block text-xs text-violet-200">{new Intl.DateTimeFormat("pt-BR", {day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}).format(new Date(nextEvent.start))}</span>}
        </button>
        <button type="button" onClick={() => navigateTo("vyra-tasks")} className="min-w-0 rounded-2xl border border-white/10 bg-slate-900/55 p-3 text-left hover:border-violet-400/50">
          <span className="block text-xs text-slate-400">Sua evolução hoje</span>
          <span className="mt-1 block text-lg font-semibold text-white">{progress === null ? "—" : `${progress}%`}</span>
          <span className="block text-xs text-slate-400">{metrics?.pending ?? "—"} tarefas pendentes</span>
        </button>
      </section>
      <Link href="/journey" className="flex items-center justify-between gap-3 rounded-2xl border border-fuchsia-400/20 bg-gradient-to-r from-fuchsia-950/35 to-slate-950 px-4 py-3 hover:border-fuchsia-400/50">
        <span className="min-w-0"><span className="block text-sm font-semibold text-white">✧ Sua jornada continua</span><span className="block text-xs text-slate-300">Metas, missões e conquistas</span></span>
        <span aria-hidden="true" className="text-fuchsia-200">→</span>
      </Link>
    </main>
  );
}
