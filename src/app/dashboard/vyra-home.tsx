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
    <main className="mx-auto flex w-full max-w-5xl min-w-0 flex-col gap-4 pb-5" aria-label="MIKA Universe — MYRYRA Flow+">
      <section className="relative isolate overflow-hidden rounded-[28px] border border-violet-400/30 bg-[#0d1029] p-5 shadow-[0_20px_80px_rgba(77,18,130,.18)] sm:p-7" aria-label="MIKA Universe">
        <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-violet-600/25 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -left-20 bottom-0 h-48 w-48 rounded-full bg-fuchsia-600/15 blur-3xl" />
        <div className="relative flex items-center justify-between gap-3">
          <span className="text-[11px] font-bold uppercase tracking-[.22em] text-violet-200">MYRYRA FLOW+ <span className="ml-2 rounded-full bg-violet-500/20 px-2 py-1 text-[10px] tracking-normal text-violet-100">MIKA Universe · Preview</span></span>
          <span className="shrink-0 text-xs text-slate-400">{today ? new Intl.DateTimeFormat("pt-BR",{day:"2-digit",month:"short"}).format(today) : "Seu momento"}</span>
        </div>
        <div className="relative mt-5 flex flex-col items-center gap-5 sm:flex-row sm:items-center">
          <div className="relative flex h-36 w-36 shrink-0 items-center justify-center rounded-full border border-violet-400/40 bg-gradient-to-br from-violet-950 via-indigo-950 to-fuchsia-950 shadow-[0_0_45px_rgba(147,51,234,.35)] sm:h-44 sm:w-44">
            <div aria-hidden="true" className="absolute inset-2 rounded-full border border-fuchsia-400/30" />
            <img src="/myka-transparente.png" alt="MIKA original da MYRYRA" className="relative h-full w-full object-contain p-2" />
          </div>
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <p className="text-xs font-medium uppercase tracking-[.2em] text-violet-300">Sua IA parceira de evolução</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">MIKA Universe</h1>
            <p className="mt-2 text-sm text-slate-300">Sonhe, planeje e conquiste. Seu universo pessoal começa aqui.</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
              {["✦ Planejamento inteligente","◇ Jornadas pessoais","♡ Equilíbrio e bem-estar"].map((label) => <span key={label} className="rounded-full border border-violet-400/25 bg-violet-500/10 px-3 py-2 text-[11px] text-violet-100">{label}</span>)}
            </div>
          </div>
        </div>
        <div className="relative mt-6 rounded-2xl border border-violet-400/30 bg-[#171936]/90 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <img src="/myka-transparente.png" alt="" className="h-10 w-10 shrink-0 object-contain" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-violet-200">MIKA está com você</p>
              <p className="mt-2 text-lg font-semibold text-white">Qual será sua próxima conquista?</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">Posso ajudar a organizar sua agenda, definir prioridades e transformar objetivos em pequenas ações.</p>
            </div>
          </div>
          <button type="button" onClick={() => navigateTo("vyra-ai")} className="mt-5 flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border border-violet-400/40 bg-violet-500/10 px-4 text-left text-sm text-violet-100 transition hover:bg-violet-500/20 focus-visible:outline-2 focus-visible:outline-violet-300">
            <span>✧ &nbsp; Converse com a MIKA...</span><span className="rounded-lg bg-violet-500 px-3 py-2 font-bold text-white">↗</span>
          </button>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <button type="button" onClick={() => navigateTo("vyra-calendar")} className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-slate-100 hover:bg-violet-500/20">▦ &nbsp; Minha agenda</button>
            <button type="button" onClick={() => navigateToQuickAction?.("capture")} className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-slate-100 hover:bg-violet-500/20">＋ &nbsp; Criar tarefa</button>
            <Link href="/journey" className="rounded-xl border border-white/10 bg-white/5 p-3 text-center text-xs text-slate-100 hover:bg-violet-500/20">◇ &nbsp; Minhas jornadas</Link>
            <button type="button" onClick={() => navigateTo("vyra-performance")} className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-slate-100 hover:bg-violet-500/20">✧ &nbsp; Meu progresso</button>
          </div>
        </div>
      </section>
      <div className="grid min-w-0 gap-4 md:grid-cols-2">
        <section className="rounded-2xl border border-violet-400/20 bg-[#111629] p-5" aria-label="Sua próxima ação">
          <div className="flex items-center justify-between"><p className="text-[11px] font-bold uppercase tracking-[.18em] text-violet-300">Seu foco agora</p><span className="rounded-full bg-violet-500/15 px-2 py-1 text-[10px] text-violet-200">Próxima ação</span></div>
          <p className="mt-4 text-lg font-semibold text-white">{smartSuggestion.message}</p>
          <button type="button" onClick={() => navigateTo(smartSuggestion.module)} className="mt-4 rounded-xl bg-violet-500 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-400">{smartSuggestion.action} ↗</button>
        </section>
        <section className="rounded-2xl border border-violet-400/20 bg-[#111629] p-5" aria-label="Seu universo hoje">
          <p className="text-[11px] font-bold uppercase tracking-[.18em] text-violet-300">Seu universo hoje</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button type="button" onClick={() => navigateTo("vyra-calendar")} className="min-w-0 rounded-xl bg-white/5 p-3 text-left hover:bg-violet-500/15"><span className="block text-xs text-slate-400">Próximo evento</span><span className="mt-2 block truncate text-sm font-semibold text-white">{nextEvent ? nextEvent.title : agendaError ? "Indisponível" : "Agenda livre"}</span>{nextEvent && <span className="mt-1 block text-[11px] text-violet-200">{new Intl.DateTimeFormat("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}).format(new Date(nextEvent.start))}</span>}</button>
            <button type="button" onClick={() => navigateTo("vyra-tasks")} className="min-w-0 rounded-xl bg-white/5 p-3 text-left hover:bg-violet-500/15"><span className="block text-xs text-slate-400">Sua evolução</span><span className="mt-2 block text-sm font-semibold text-white">{progress === null ? "—" : `${progress}% concluído`}</span><span className="mt-1 block text-[11px] text-violet-200">{metrics?.pending ?? "—"} tarefas pendentes</span></button>
          </div>
          <Link href="/journey" className="mt-3 block rounded-xl border border-violet-400/25 bg-violet-500/10 p-3 text-center text-xs font-semibold text-violet-100 hover:bg-violet-500/20">Explorar minhas jornadas ↗</Link>
        </section>
      </div>
    </main>
  );
}
