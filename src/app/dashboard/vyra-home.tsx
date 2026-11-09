"use client";

import { useEffect, useState } from "react";
import { useVyraActiveModule, useVyraNavigation } from "./vyra-module-context";
import { loadVyraMetrics } from "./vyra-metrics-service";
import { getCompletionRate, type VyraMetrics } from "./vyra-metrics";
import { getCloudEvents } from "@/lib/event-cloud";
import WhatNowCard from "./what-now-card";

const portals = [
  { label: "Meu dinheiro", subtitle: "Gastos e objetivos", icon: "◇", module: "vyra-finance" },
  { label: "Bem-estar", subtitle: "Cuide de você", icon: "♡", module: "vyra-health" },
  { label: "Meu progresso", subtitle: "Suas conquistas", icon: "◎", module: "vyra-performance" },
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
function localDayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function dayOfYear(date: Date) {
  const today = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.floor((today - Date.UTC(date.getFullYear(), 0, 1)) / 86400000);
}

export default function VyraHome() {
  const activeModule = useVyraActiveModule();
  const { navigateTo, navigateToQuickAction } = useVyraNavigation();
  const [metrics, setMetrics] = useState<VyraMetrics | null>(null);
  const [nextEvent, setNextEvent] = useState<{ title: string; start: string } | null>(null);
  const [dayEvents, setDayEvents] = useState<{ title: string; start: string }[]>([]);
  const [agendaError, setAgendaError] = useState(false);
  const [today] = useState<Date | null>(() => new Date());

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
        if (!cancelled) {
          setNextEvent(events[0] ?? null);
          const todayKey = localDayKey(new Date());
          setDayEvents(events.filter(event => localDayKey(new Date(event.start)) === todayKey).slice(0, 5));
          setAgendaError(false);
        }
      } catch {
        if (!cancelled) { setAgendaError(true); setDayEvents([]); setNextEvent(null); }
      }
    }
    void loadAgenda();
    window.addEventListener("myryra:events-updated", loadAgenda);
    return () => {
      cancelled = true;
      window.removeEventListener("myryra:tasks-updated", refreshMetrics);
      window.removeEventListener("myryra:events-updated", loadAgenda);
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
        <h1 className="mt-2 max-w-xl text-2xl font-semibold leading-tight text-white sm:text-3xl">Menos coisas na cabeça. Mais tempo para viver.</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-200">A MYRYRA reúne suas tarefas, compromissos e dinheiro. Você vê o que importa agora e a MIKA ajuda a dar o próximo passo.</p>
        <p className="mt-3 text-sm leading-relaxed text-violet-200" aria-label="Inspiração do dia">{today ? dailyMessages[dayOfYear(today)%dailyMessages.length] : "Um dia de cada vez. Grandes mudanças começam com pequenos passos."}</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => navigateToQuickAction?.("capture")} className="rounded-xl bg-violet-600 px-3 py-3 text-sm font-semibold text-white hover:bg-violet-500 focus-visible:outline-2 focus-visible:outline-violet-400">+ Criar tarefa</button>
          <button type="button" onClick={() => navigateTo("vyra-ai")} className="rounded-xl border border-violet-400/35 bg-violet-500/15 px-3 py-3 text-sm font-semibold text-violet-100 hover:bg-violet-500/25 focus-visible:outline-2 focus-visible:outline-violet-400">✦ MIKA</button>
        </div>
      </section>

      <section aria-label="Seu dia interativo" className="rounded-2xl border border-violet-400/25 bg-slate-900/70 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-white">O que precisa da sua atenção hoje?</h2>
            <p className="mt-1 text-xs text-slate-300">Veja seus próximos compromissos e escolha uma tarefa para começar.</p>
          </div>
          <button type="button" onClick={() => navigateTo("vyra-calendar")} className="rounded-lg border border-violet-400/35 px-3 py-2 text-xs font-semibold text-violet-200 hover:bg-violet-500/15">Ver agenda</button>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={() => navigateTo("vyra-calendar")} className="rounded-xl border border-white/10 bg-slate-950/55 p-3 text-left hover:border-violet-400/50">
            <span className="block text-xs text-violet-300">A seguir · Agenda</span>
            <span className="mt-1 block truncate text-sm font-semibold text-white">{nextEvent ? nextEvent.title : agendaError ? "Não foi possível consultar sua agenda" : "Sem compromissos futuros"}</span>
            {nextEvent && <span className="mt-1 block text-xs text-slate-300">{new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(nextEvent.start))}</span>}
          </button>
          <button type="button" onClick={() => navigateTo("vyra-tasks")} className="rounded-xl border border-white/10 bg-slate-950/55 p-3 text-left hover:border-violet-400/50">
            <span className="block text-xs text-violet-300">A seguir · Prioridades</span>
            <span className="mt-1 block text-sm font-semibold text-white">{metrics ? metrics.pending + " tarefa(s) pendente(s)" : "Consultar minhas tarefas"}</span>
            <span className="mt-1 block text-xs text-slate-300">{smartSuggestion.message}</span>
          </button>
        </div>
        <div className="mt-3 rounded-xl border border-white/10 bg-slate-950/40 p-3" aria-label="Linha do tempo de hoje">
          <h3 className="text-xs font-semibold text-violet-200">Linha do tempo de hoje</h3>
          {dayEvents.length > 0 ? (
            <ol className="mt-2 space-y-2">
              {dayEvents.map((event, index) => (
                <li key={event.start + "-" + index} className="flex items-start gap-3 border-l-2 border-violet-500/50 pl-3">
                  <time className="shrink-0 text-xs font-semibold text-violet-300" dateTime={event.start}>{new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(event.start))}</time>
                  <span className="min-w-0 flex-1 break-words text-xs text-white">{event.title}</span>
                  <button type="button" onClick={() => navigateTo("vyra-calendar")} aria-label={`Ver ou reagendar ${event.title} na Agenda`} className="shrink-0 rounded-md border border-violet-400/30 px-2 py-1 text-xs text-violet-200 hover:bg-violet-500/15">Ver / reagendar</button>
                </li>
              ))}
            </ol>
          ) : <p className="mt-2 text-xs text-slate-400">{agendaError ? "Agenda indisponível. Tente novamente na Agenda." : "Nenhum compromisso restante para hoje."}</p>}
        </div>
        <div className="mt-3 flex justify-end">
          <button type="button" onClick={() => navigateTo("vyra-tasks")} className="rounded-lg border border-violet-400/35 px-3 py-2 text-xs font-semibold text-violet-200 hover:bg-violet-500/15">Concluir tarefas</button>
        </div>
      </section>

      <details className="group rounded-2xl border border-violet-400/35 bg-gradient-to-br from-violet-950/70 via-slate-900/85 to-slate-950 p-4 shadow-sm sm:p-5">
        <summary className="flex cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
          <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-700/45 text-2xl text-violet-200">✦</span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-white">Uma dica para você</span>
            <span className="mt-1 block text-xs leading-relaxed text-violet-200">{smartSuggestion.message}</span>
          </span>
          <span aria-hidden="true" className="text-lg text-violet-200 transition-transform group-open:rotate-90">›</span>
        </summary>
        <div className="mt-4 border-t border-violet-400/15 pt-3">
          <button type="button" onClick={() => navigateTo(smartSuggestion.module)} className="mb-3 rounded-xl border border-violet-400/30 bg-violet-500/15 px-4 py-2 text-xs font-semibold text-violet-100 hover:bg-violet-500/25 focus-visible:outline-2 focus-visible:outline-violet-400">{smartSuggestion.action} →</button>
          <WhatNowCard />
        </div>
      </details>

      <section aria-label="O que você quer fazer?">
        <h2 className="mb-3 text-base font-semibold text-white">Outras áreas da sua vida</h2>
        <div className="grid grid-cols-3 gap-2">
          {portals.map(item => <button key={item.label} type="button" onClick={() => navigateTo(item.module)} className="flex min-h-20 min-w-0 flex-col items-center justify-center gap-1 rounded-xl border border-violet-400/15 bg-slate-900/65 p-2 text-center transition hover:border-violet-400/60 hover:bg-violet-500/15 focus-visible:outline-2 focus-visible:outline-violet-400">
            <span className="text-xl text-violet-300" aria-hidden="true">{item.icon}</span>
            <span className="break-words text-xs font-semibold leading-snug text-white sm:text-sm">{item.label}</span>
            <span className="hidden break-words text-xs leading-snug text-slate-400 sm:block">{item.subtitle}</span>
          </button>)}
        </div>
      </section>
      <details aria-label="Como a MYRYRA ajuda" className="rounded-2xl border border-violet-400/20 bg-slate-900/65 p-4 sm:p-5">
        <summary className="cursor-pointer text-sm font-semibold text-violet-200">Primeira vez aqui? Veja como começar</summary>
        <div className="mt-3">
        <h2 className="text-base font-semibold text-white">Três passos para começar</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {[
            { title: "1. Anote", text: "Coloque suas tarefas e compromissos em um só lugar.", action: "Criar tarefa", module: "vyra-tasks", quick: true },
            { title: "2. Escolha", text: "Veja o que é importante hoje e comece por uma coisa.", action: "Ver minhas tarefas", module: "vyra-tasks" },
            { title: "3. Peça ajuda", text: "A MIKA ajuda a organizar ideias e encontrar o próximo passo.", action: "Falar com a MIKA", module: "vyra-ai" },
          ].map(item => (
            <div key={item.title} className="rounded-xl border border-white/10 bg-slate-950/50 p-3">
              <h3 className="text-sm font-semibold text-white">{item.title}</h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-300">{item.text}</p>
              <button type="button" onClick={() => item.quick ? navigateToQuickAction?.("capture") : navigateTo(item.module)} className="mt-3 rounded-lg border border-violet-400/35 px-3 py-2 text-xs font-semibold text-violet-200 hover:bg-violet-500/15">{item.action}</button>
            </div>
          ))}
        </div>
        <details className="mt-3 rounded-xl border border-white/10 p-3">
          <summary className="cursor-pointer text-xs font-semibold text-violet-200">Tarefa, compromisso ou plano?</summary>
          <p className="mt-2 text-xs leading-relaxed text-slate-300">Tarefa é algo para fazer. Compromisso tem dia e horário. Plano reúne passos para alcançar um objetivo.</p>
        </details>
        </div>
      </details>

      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <span className="text-xs text-slate-400">Precisa de mais alguma coisa?</span>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => navigateTo("vyra-settings")} className="rounded-lg border border-white/15 px-3 py-2 text-xs font-medium text-slate-300 hover:border-violet-400/50">Minha conta</button>
          <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("myryra:open-support"))} className="rounded-lg border border-white/15 px-3 py-2 text-xs font-medium text-slate-300 hover:border-violet-400/50">Ajuda</button>
        </div>
      </div>


    </main>
  );
}
