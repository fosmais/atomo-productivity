"use client";

import { useEffect, useState } from "react";
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
  const [shareMessage, setShareMessage] = useState("");
  const [today, setToday] = useState<Date | null>(null);

  useEffect(() => { setToday(new Date()); }, []);

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
  const shareText = progress === null ? "" : "Meu score de produtividade na MYRYRA: " + progress + "% de tarefas concluídas. Organize seu dia com a MIKA! https://myryra.com";
  async function shareScore() {
    if (!shareText) return;
    try {
      if (navigator.share) await navigator.share({ title: "Meu score MYRYRA", text: shareText });
      else { await navigator.clipboard.writeText(shareText); setShareMessage("Score copiado! Cole na sua rede social."); }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      setShareMessage("Não foi possível compartilhar. Use o botão do WhatsApp.");
    }
  }

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

      <section aria-label="Explore seu universo">
        <h2 className="mb-3 text-base font-semibold text-white">Explore seu universo</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {portals.map(item => <button key={item.label} type="button" onClick={() => navigateTo(item.module)} className="flex min-h-32 flex-col items-start justify-center gap-2 rounded-xl border border-violet-400/15 bg-slate-900/65 p-3 text-left transition hover:border-violet-400/60 hover:bg-violet-500/15 focus-visible:outline-2 focus-visible:outline-violet-400">
            <span className="text-2xl text-violet-300" aria-hidden="true">{item.icon}</span>
            <span className="text-sm font-semibold leading-snug text-white">{item.label}</span>
            <span className="text-xs leading-snug text-slate-400">{item.subtitle}</span>
          </button>)}
        </div>
      </section>
      <details className="rounded-xl border border-violet-400/20 bg-slate-900/50 p-3">
        <summary className="cursor-pointer text-sm font-semibold text-violet-100">Seu score e compartilhamento {progress===null?"":`· ${progress}%`}</summary>
        <p className="mt-2 text-xs text-slate-400">Percentual de tarefas concluídas entre as cadastradas. Não representa uma avaliação pessoal.</p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress??0} aria-label="Tarefas concluídas"><div className="h-full rounded-full bg-violet-400" style={{width:`${progress??0}%`}}/></div>
        <div className="mt-3 flex flex-wrap gap-2">
          <a href={shareText?`https://wa.me/?text=${encodeURIComponent(shareText)}`:undefined} target="_blank" rel="noopener noreferrer" aria-disabled={!shareText} onClick={event=>{if(!shareText)event.preventDefault();}} className={`rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100 ${!shareText?"pointer-events-none opacity-50":""}`}>Compartilhar no WhatsApp</a>
          <button type="button" disabled={!shareText} onClick={()=>void shareScore()} className="rounded-lg border border-violet-400/30 px-3 py-2 text-xs text-violet-100 disabled:opacity-50">Outras redes</button>
        </div>
        {shareMessage&&<p role="status" className="mt-2 text-xs text-violet-200">{shareMessage}</p>}
      </details>
      <details className="rounded-xl border border-white/10 bg-slate-900/45 p-3">
        <summary className="cursor-pointer text-sm font-semibold text-violet-200">Todas as ferramentas</summary>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {[
            {label:"Nova tarefa",module:"vyra-tasks",action:"capture"},
            {label:"Agenda",module:"vyra-calendar"},
            {label:"Lembretes",module:"vyra-tasks",action:"capture"},
            {label:"Metas",module:"vyra-tasks",action:"goals"},
            {label:"Planejamento",module:"vyra-tasks",action:"kanban"},
            {label:"Configurações",module:"vyra-settings"}
          ].map(item=><button key={item.label} type="button" onClick={()=>"action" in item && item.action ? navigateToQuickAction?.(item.action) : navigateTo(item.module)} className="rounded-lg border border-white/10 bg-slate-950/70 px-3 py-3 text-left text-xs font-medium text-white hover:border-violet-400/50">{item.label}</button>)}
        </div>
      </details>

      <details className="rounded-xl border border-white/10 bg-slate-900/35 px-3 py-2">
        <summary className="cursor-pointer text-xs font-semibold text-violet-200">✦ Sugestão inteligente · O que fazer agora?</summary>
        <div className="mt-3"><WhatNowCard /></div>
      </details>
    </main>
  );
}
