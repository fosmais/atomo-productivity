"use client";

const sections = [
  { id: "planner-today", label: "Meu dia" },
  { id: "planner-focus", label: "Foco e rotina" },
  { id: "planner-intelligence", label: "Planejamento inteligente" },
];

export default function PlannerQuickNav() {
  return (
    <nav aria-label="Acesso rápido ao Planner" className="flex flex-wrap gap-2">
      {sections.map(({ id, label }, index) => (
        <button
          key={id}
          type="button"
          onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })}
          className={`rounded-full border px-4 py-2 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400 ${index === 0 ? "border-violet-400/40 bg-violet-500/15 text-violet-100 hover:bg-violet-500/25" : "border-white/15 bg-white/[0.04] text-slate-300 hover:border-violet-400/40 hover:text-white"}`}
        >
          {label}
        </button>
      ))}
    </nav>
  );
}
