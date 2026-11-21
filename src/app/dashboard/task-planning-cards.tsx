"use client";

import { useEffect, useState, type KeyboardEvent, type ReactNode } from "react";
import { useVyraNavigation } from "./vyra-module-context";

type View = "tasks" | "today" | "intelligence" | "focus";

const sections: { id: View; icon: string; title: string; description: string }[] = [
  { id: "tasks", icon: "☑", title: "Minhas tarefas", description: "Metas, planos e quadro" },
  { id: "today", icon: "☼", title: "Meu dia", description: "Prioridades e rotina" },
  { id: "intelligence", icon: "✧", title: "Planejamento inteligente", description: "Copiloto e replanejamento" },
  { id: "focus", icon: "◎", title: "Foco e evolução", description: "Produtividade e progresso" },
];

export default function TaskPlanningCards({ tasks, today, intelligence, focus }: {
  tasks: ReactNode;
  today: ReactNode;
  intelligence: ReactNode;
  focus: ReactNode;
}) {
  const [active, setActive] = useState<View>("tasks");
  const { activeModule, quickAction } = useVyraNavigation();
  useEffect(() => {
    if (activeModule !== "vyra-tasks" || !quickAction) return;
    let active = true;
    queueMicrotask(() => { if (active) setActive("tasks"); });
    const timer = window.setTimeout(() => {
      const details = document.querySelector<HTMLDetailsElement>(`[data-feature-id="${quickAction}"]`);
      if (details) {
        details.open = true;
        details.scrollIntoView({ behavior: "smooth", block: "center" });
        if (quickAction === "capture") {
          window.setTimeout(() => window.dispatchEvent(new Event("myryra:focus-quick-capture")), 100);
        } else if (quickAction === "goals") {
          window.setTimeout(() => document.querySelector<HTMLInputElement>('[aria-label="Nome da meta"]')?.focus({ preventScroll: true }), 100);
        }
      }
    }, 80);
    return () => { active = false; window.clearTimeout(timer); };
  }, [activeModule, quickAction]);
  const panels: Record<View, ReactNode> = { tasks, today, intelligence, focus };

  function selectSection(id: View) {
    setActive(id);
    if (id === "tasks") {
      window.requestAnimationFrame(() => {
        const kanban = document.querySelector<HTMLDetailsElement>('[data-feature-id="kanban"]');
        if (kanban) {
          kanban.open = true;
          kanban.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
    }
    if (id === "focus") {
      window.requestAnimationFrame(() => {
        const focusPanel = document.querySelector<HTMLDetailsElement>('[data-feature-id="planning-focus"]');
        if (focusPanel) focusPanel.open = true;
      });
    }
  }

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === "Home" ? 0
      : event.key === "End" ? sections.length - 1
      : (index + (event.key === "ArrowRight" ? 1 : -1) + sections.length) % sections.length;
    selectSection(sections[next].id);
    document.getElementById(`planning-tab-${sections[next].id}`)?.focus();
  }

  return (
    <div className="min-w-0 space-y-5">
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2" role="tablist" aria-label="Áreas de tarefas e planejamento">
        {sections.map((section, index) => (
          <button
            key={section.id}
            id={`planning-tab-${section.id}`}
            type="button"
            role="tab"
            aria-selected={active === section.id}
            tabIndex={active === section.id ? 0 : -1}
            onKeyDown={event => onTabKeyDown(event, index)}
            aria-controls={`planning-panel-${section.id}`}
            onClick={() => selectSection(section.id)}
            className={`flex min-h-[116px] min-w-0 flex-col justify-center rounded-2xl border p-5 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400 ${
              active === section.id
                ? "border-violet-400/70 bg-violet-600/15 shadow-lg shadow-violet-950/20"
                : "border-white/15 bg-slate-900/75 hover:border-violet-400/50 hover:bg-slate-800/80"
            }`}
          >
            <span aria-hidden="true" className="mb-3 block text-2xl text-violet-300">{section.icon}</span>
            <span className="block text-base font-semibold text-white">{section.title}</span>
            <span className="mt-1 block text-xs text-slate-300">{section.description}</span>
          </button>
        ))}
      </div>
      <details className="rounded-xl border border-violet-400/20 bg-slate-900/60 p-4 text-sm text-slate-200">
        <summary className="cursor-pointer font-semibold text-violet-200">Qual a diferença entre plano, compromisso e tarefa?</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div><strong className="text-white">🎯 Plano</strong><p className="mt-1 text-slate-300">Um objetivo com várias etapas. Ex.: organizar uma viagem.</p></div>
          <div><strong className="text-white">📅 Compromisso</strong><p className="mt-1 text-slate-300">Algo com data e horário definidos. Ex.: consulta às 15h.</p></div>
          <div><strong className="text-white">☑ Tarefa</strong><p className="mt-1 text-slate-300">Uma ação para concluir. Ex.: comprar as passagens.</p></div>
        </div>
        <p className="mt-3 text-xs text-violet-200">Dica: um plano pode gerar tarefas e compromissos. Peça ajuda à MYKA para decidir por onde começar.</p>
      </details>
      {sections.map(section => (
        <section
          key={section.id}
          id={`planning-panel-${section.id}`}
          role="tabpanel"
          aria-labelledby={`planning-tab-${section.id}`}
          hidden={active !== section.id}
          className={active === section.id ? "min-w-0" : "hidden"}
        >
          {panels[section.id]}
        </section>
      ))}
    </div>
  );
}
