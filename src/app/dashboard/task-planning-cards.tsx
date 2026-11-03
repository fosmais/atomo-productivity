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
    setActive("tasks");
    const timer = window.setTimeout(() => {
      const details = document.querySelector<HTMLDetailsElement>(`[data-feature-id="${quickAction}"]`);
      if (details) {
        details.open = true;
        details.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 80);
    return () => window.clearTimeout(timer);
  }, [activeModule, quickAction]);
  const panels: Record<View, ReactNode> = { tasks, today, intelligence, focus };

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === "Home" ? 0
      : event.key === "End" ? sections.length - 1
      : (index + (event.key === "ArrowRight" ? 1 : -1) + sections.length) % sections.length;
    setActive(sections[next].id);
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
            onClick={() => setActive(section.id)}
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
