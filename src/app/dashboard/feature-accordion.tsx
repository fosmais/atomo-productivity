"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

const prefix = "myryra:expanded:v1:";
const eventName = "myryra:accordion-all";
const helpExamples: Record<string, string> = {
  briefing: "Exemplo: confira seus compromissos e as tarefas prioritárias antes de começar o dia.",
  focus: "Exemplo: escolha uma tarefa, ajuste o temporizador para 25 minutos e inicie uma sessão sem distrações.",
  "planning-settings": "Exemplo: defina seus horários de trabalho para receber sugestões compatíveis com sua rotina.",
  "daily-copilot": "Exemplo: peça um plano para o dia com base nas tarefas que precisam de atenção.",
  replan: "Exemplo: revise tarefas atrasadas e escolha como reorganizá-las antes de confirmar mudanças.",
  goals: "Exemplo: acompanhe uma pequena meta pessoal e registre sua evolução.",
  plans: "Exemplo: reúna tarefas relacionadas em um plano e acompanhe o progresso.",
  favorites: "Exemplo: salve os recursos que você mais usa para acessá-los rapidamente.",
  capture: "Exemplo: registre uma ideia rapidamente e transforme-a em tarefa para organizar depois.",
  kanban: "Exemplo: mova uma tarefa de A fazer para Em andamento e depois para Concluído.",
  availability: "Exemplo: reserve períodos de trabalho e veja os intervalos disponíveis para tarefas.",
  autopilot: "Exemplo: deixe a MYRYRA sugerir a ordem das atividades, revisando as propostas antes de aplicá-las.",
  scheduling: "Exemplo: encontre um horário adequado para uma tarefa sem ocupar compromissos existentes.",
  weekly: "Exemplo: analise a semana para identificar prioridades e pontos de atenção.",
  performance: "Exemplo: acompanhe a evolução das tarefas concluídas e dos seus indicadores.",
  mfa: "Exemplo: ative uma segunda etapa de verificação para proteger sua conta.",
  "external-integrations": "Exemplo: confira quais serviços estão disponíveis e quais conexões ainda estão em desenvolvimento.",
  feedback: "Exemplo: relate uma dificuldade ou sugira uma melhoria para a plataforma.",
};

function storedOpen(userId: string, id: string, initial: boolean): boolean {
  try {
    const value = localStorage.getItem(prefix + userId + ":" + id);
    return value === null ? initial : value === "true";
  } catch { return initial; }
}

export function FeatureAccordion({ id, title, description, userId, defaultOpen = false, children }: {
  id: string; title: string; description: string; userId: string; defaultOpen?: boolean; children: ReactNode;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const helpId = useId();
  const helpRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!helpOpen) return;
    const outside = (event: PointerEvent) => { if (!helpRef.current?.contains(event.target as Node)) setHelpOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setHelpOpen(false); };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [helpOpen]);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const oauthCallback = id === "external-integrations" &&
      new URLSearchParams(window.location.search).has("google_calendar");
    let journeyCapture = false;
    if (id === "capture") { try { journeyCapture = Boolean(sessionStorage.getItem("myryra:journey-task-prefill:v1")); } catch { /* optional */ } }
    node.open = oauthCallback || journeyCapture || storedOpen(userId, id, defaultOpen);
    if (journeyCapture) { try { sessionStorage.removeItem("myryra:journey-task-prefill:v1"); } catch { /* optional */ } }
    if (oauthCallback) {
      window.requestAnimationFrame(() => {
        node.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }
    const onAll = (event: Event) => {
      const detail = (event as CustomEvent<{ open: boolean }>).detail;
      if (typeof detail?.open === "boolean") node.open = detail.open;
    };
    const onJourneyCapture = () => {
      if (id !== "capture") return;
      node.open = true;
      window.requestAnimationFrame(() => node.scrollIntoView({ behavior: "smooth", block: "center" }));
    };
    window.addEventListener("myryra:journey-open-capture", onJourneyCapture);
    window.addEventListener(eventName, onAll);
    return () => { window.removeEventListener(eventName, onAll); window.removeEventListener("myryra:journey-open-capture", onJourneyCapture); };
  }, [id, userId, defaultOpen]);
  return <details data-feature-id={id} ref={ref} onToggle={event => {
    if (!event.currentTarget.isConnected) return;
    try { localStorage.setItem(prefix + userId + ":" + id, String(event.currentTarget.open)); } catch { /* optional */ }
  }} className="group relative min-w-0 overflow-visible rounded-2xl border border-white/15 bg-slate-900/75 shadow-sm transition-all duration-200 hover:border-violet-400/50 hover:bg-slate-800/80 open:border-violet-400/70 open:bg-violet-600/10 open:shadow-lg open:shadow-violet-950/20">
    <summary className="flex min-h-[112px] cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 pr-20 text-left marker:hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400 sm:px-5 sm:py-5 sm:pr-28 [&::-webkit-details-marker]:hidden">
      <span className="min-w-0"><span className="block text-[15px] font-semibold tracking-tight text-white sm:text-base">{title}</span><span className="mt-1.5 block text-sm leading-relaxed text-slate-400">{description}</span></span>
      <span aria-hidden="true" className="absolute right-4 top-[30px] flex h-8 w-8 sm:right-5 sm:h-9 sm:w-9 items-center justify-center rounded-xl border border-violet-400/25 bg-violet-500/10 text-xl text-violet-200 transition-all duration-200 group-hover:bg-violet-500/20 group-open:rotate-45 group-open:border-violet-400/50">+</span>
    </summary>
    <div ref={helpRef} className="absolute right-14 top-[30px] z-20 sm:right-16">
      <button type="button" aria-label={`Como funciona: ${title}`} aria-expanded={helpOpen} aria-controls={helpOpen ? helpId : undefined}
        onClick={() => setHelpOpen((value) => !value)}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-violet-400/45 bg-violet-500/10 text-xs font-semibold text-violet-200 transition hover:bg-violet-500/25 focus-visible:outline-2 focus-visible:outline-violet-400">i</button>
      {helpOpen && <div id={helpId} role="region" aria-label={`Sobre ${title}`}
        className="absolute right-0 top-full z-30 mt-2 w-[min(19rem,calc(100vw-3rem))] rounded-xl border border-violet-400/50 bg-slate-950 p-4 text-left shadow-2xl">
        <strong className="block text-sm font-semibold text-violet-200">{title}</strong>
        <p className="mt-2 text-sm leading-relaxed text-slate-200">{description}</p>
        <p className="mt-2 text-xs leading-relaxed text-violet-200">{helpExamples[id] ?? "Abra a ferramenta para explorar seus recursos."}</p>
        <p className="mt-2 text-xs text-slate-400">Toque no cartão para abrir a ferramenta.</p>
      </div>}
    </div>
    <div className="min-w-0 space-y-4 border-t border-white/10 bg-slate-950/25 px-3 py-4 sm:px-5 sm:py-5">{children}</div>
  </details>;
}

export function AccordionControls() {
  return <div className="flex flex-wrap justify-end gap-2" aria-label="Controles dos painéis">
    <button type="button" onClick={() => window.dispatchEvent(new CustomEvent(eventName, { detail: { open: true } }))} className="rounded-lg border border-violet-400/30 px-3 py-2 text-xs font-medium text-violet-200 hover:bg-violet-500/15">Expandir todos</button>
    <button type="button" onClick={() => window.dispatchEvent(new CustomEvent(eventName, { detail: { open: false } }))} className="rounded-lg border border-violet-400/30 px-3 py-2 text-xs font-medium text-violet-200 hover:bg-violet-500/15">Recolher todos</button>
  </div>;
}
