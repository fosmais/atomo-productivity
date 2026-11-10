"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useVyraActiveModule, useVyraNavigation } from "./vyra-module-context";
import { loadVyraMetrics } from "./vyra-metrics-service";
import { getCompletionRate, type VyraMetrics } from "./vyra-metrics";
import { getCloudEvents } from "@/lib/event-cloud";
import WhatNowCard from "./what-now-card";

const portals = [
  { label: "MIKA", subtitle: "Sua inteligência pessoal", icon: "✦", module: "vyra-ai" },
  { label: "Seu dia e futuro", subtitle: "Agenda, planos e compromissos", icon: "▦", module: "vyra-calendar" },
  { label: "Corpo e mente", subtitle: "Saúde, treino e bem-estar", icon: "♡", module: "vyra-health" },
  { label: "Organização", subtitle: "Tarefas, foco e metas", icon: "✓", module: "vyra-tasks" },
  { label: "Finanças e investimentos", subtitle: "Seu dinheiro e seus objetivos", icon: "◇", module: "vyra-finance" },
  { label: "Sua evolução", subtitle: "Score, progresso e conquistas", icon: "◎", module: "vyra-performance" },
];
const dailyMessages = [
  "Um pequeno passo hoje pode transformar o seu amanhã.",
  "Seu tempo é valioso. Escolha o que realmente importa.",
  "Grandes conquistas começam com decisões simples.",
  "Progresso não exige perfeição, exige constância.",
  "Hoje é uma nova oportunidade de cuidar de você.",
  "Organize suas prioridades e abra espaço para viver.",
  "Você não precisa fazer tudo. Comece pelo essencial.",
  "O futuro que você deseja começa nas escolhas de hoje.",
  "Cada avanço merece ser reconhecido.",
  "Faça do seu dia uma experiência com propósito.",
  "Equilíbrio também é uma forma de progresso.",
  "O melhor planejamento é aquele que cabe na sua vida.",
];
function dayOfYear(date: Date) {
  const today = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.floor((today - Date.UTC(date.getFullYear(), 0, 1)) / 86400000);
}

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
    <main className="flex min-w-0 flex-col gap-3 " aria-label="Início MYRYRA">
      <section className="rounded-2xl border border-violet-400/25 bg-gradient-to-br from-violet-950/65 via-slate-900/80 to-slate-950 p-4 sm:p-6" aria-label="Boas-vindas MYRYRA">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-300">{today ? new Intl.DateTimeFormat("pt-BR",{weekday:"long",day:"numeric",month:"long"}).format(today) : "MYRYRA · SEU ESPAÇO"}</p>
        <h1 className="mt-2 max-w-xl text-2xl font-semibold leading-tight text-white sm:text-3xl">Como podemos tornar seu dia extraordinário?</h1>
        <p className="mt-3 text-sm leading-relaxed text-violet-200" aria-label="Inspiração do dia">{today ? dailyMessages[dayOfYear(today)%dailyMessages.length] : "Um dia de cada vez. Grandes mudanças começam com pequenos passos."}</p>
        <button type="button" onClick={() => navigateTo("vyra-ai")} className="mt-4 flex w-full items-center gap-3 rounded-xl border border-violet-400/30 bg-violet-500/15 p-3 text-left transition hover:bg-violet-500/25 focus-visible:outline-2 focus-visible:outline-violet-400">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-700/60 text-xl text-violet-100" aria-hidden="true">✦</span>
          <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-white">Sua MIKA está aqui</span><span className="block text-xs text-violet-200">Planeje, converse ou descubra seu próximo passo.</span></span>
          <span className="text-violet-200" aria-hidden="true">↗</span>
        </button>
      </section>

      <section className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2" aria-label="Resumo rápido">
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

      <details className="group rounded-2xl border border-violet-400/35 bg-gradient-to-br from-violet-950/70 via-slate-900/85 to-slate-950 p-4 shadow-sm sm:p-5">
        <summary className="flex cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
          <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-700/45 text-2xl text-violet-200">✦</span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-white">Sugestão inteligente da MIKA</span>
            <span className="mt-1 block text-xs leading-relaxed text-violet-200">{smartSuggestion.message}</span>
          </span>
          <span aria-hidden="true" className="text-lg text-violet-200 transition-transform group-open:rotate-90">›</span>
        </summary>
        <div className="mt-4 border-t border-violet-400/15 pt-3">
          <button type="button" onClick={() => navigateTo(smartSuggestion.module)} className="mb-3 rounded-xl border border-violet-400/30 bg-violet-500/15 px-4 py-2 text-xs font-semibold text-violet-100 hover:bg-violet-500/25 focus-visible:outline-2 focus-visible:outline-violet-400">{smartSuggestion.action} →</button>
          <WhatNowCard />
        </div>
      </details>

      <Link href="/journey" className="flex items-center gap-3 rounded-2xl border border-violet-400/40 bg-gradient-to-r from-violet-900/70 to-slate-900 p-4 transition hover:border-violet-300" aria-label="Abrir MYRYRA Journey">
        <span className="text-3xl text-violet-200" aria-hidden="true">✧</span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-white">MYRYRA Journey</span>
          <span className="block text-xs text-violet-200">Seus sonhos, missões e conquistas em um só lugar</span>
        </span>
        <span aria-hidden="true" className="text-violet-200">→</span>
      </Link>

      <section aria-label="Explore seu universo">
        <h2 className="mb-3 text-base font-semibold text-white">Explore seu universo</h2>
        <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 lg:grid-cols-3">
          {portals.map(item => <button key={item.label} type="button" onClick={() => navigateTo(item.module)} className="flex min-h-24 min-w-0 flex-col items-start justify-center gap-2 rounded-xl border border-violet-400/15 bg-slate-900/65 p-3 text-left transition hover:border-violet-400/60 hover:bg-violet-500/15 focus-visible:outline-2 focus-visible:outline-violet-400">
            <span className="text-2xl text-violet-300" aria-hidden="true">{item.icon}</span>
            <span className="break-words text-sm font-semibold leading-snug text-white">{item.label}</span>
            <span className="break-words text-xs leading-snug text-slate-400">{item.subtitle}</span>
          </button>)}
        </div>
      </section>
      <details className="group rounded-2xl border border-violet-400/20 bg-slate-900/65 p-4 sm:p-5">
        <summary className="flex cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden"><span aria-hidden="true" className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-700/25 text-xl text-violet-200">▦</span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-white">Todas as ferramentas</span><span className="mt-1 block text-xs text-slate-400">Explore os recursos adicionais da MYRYRA</span></span><span aria-hidden="true" className="text-lg text-violet-200 transition-transform group-open:rotate-90">›</span></summary>
        <div className="mt-3 grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 lg:grid-cols-3">
          {[
            {label:"Nova tarefa",module:"vyra-tasks",action:"capture"},
            {label:"Agenda",module:"vyra-calendar"},
            {label:"Lembretes",module:"vyra-tasks",action:"capture"},
            {label:"Metas",module:"vyra-tasks",action:"goals"},
            {label:"Planejamento",module:"vyra-tasks",action:"kanban"},
            {label:"Configurações",module:"vyra-settings"},
            {label:"Ajuda e suporte",module:"support"},
            {label:"Saúde",module:"vyra-health"},
            {label:"Finanças",module:"vyra-finance"},
            {label:"Sua evolução",module:"vyra-performance"}
          ].map(item=><button key={item.label} type="button" onClick={()=>item.module==="support"?window.dispatchEvent(new CustomEvent("myryra:open-support")):"action" in item && item.action ? navigateToQuickAction?.(item.action) : navigateTo(item.module)} className="min-w-0 break-words rounded-lg border border-white/10 bg-slate-950/70 px-3 py-3 text-left text-xs font-medium text-white transition hover:border-violet-400/50 focus-visible:outline-2 focus-visible:outline-violet-400">{item.label}</button>)}
        </div>
      </details>


    </main>
  );
}
