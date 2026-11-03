"use client";

import { useState, type ReactNode } from "react";

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
  const panels: Record<View, ReactNode> = { tasks, today, intelligence, focus };

  return (
    <div className="min-w-0 space-y-5">
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2" role="tablist" aria-label="Áreas de tarefas e planejamento">
        {sections.map(section => (
          <button
            key={section.id}
            id={`planning-tab-${section.id}`}
            type="button"
            role="tab"
            aria-selected={active === section.id}
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
          className={active === section.id ? "min-w-0 rounded-2xl border border-white/10 bg-slate-950/35 p-3 sm:p-5" : "hidden"}
        >
          {panels[section.id]}
        </section>
      ))}
    </div>
  );
}
