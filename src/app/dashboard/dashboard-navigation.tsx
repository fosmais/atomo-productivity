"use client";

import { useState } from "react";

type Section = "overview" | "calendar" | "pipeline" | "ai";

const sections: { id: Section; label: string }[] = [
  { id: "overview", label: "Visão geral" },
  { id: "calendar", label: "Agenda" },
  { id: "pipeline", label: "Pipeline" },
  { id: "ai", label: "Myka AI" },
];

export default function DashboardNavigation() {
  const [active, setActive] = useState<Section>("overview");

  function navigate(section: Section) {
    setActive(section);

    const element = document.getElementById(
      section === "overview" ? "dashboard-top" : section
    );

    element?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  return (
    <nav
      aria-label="Navegação principal da MYRYRA"
      className="flex flex-wrap gap-2 rounded-xl border border-slate-800 bg-slate-900 p-3"
    >
      {sections.map((section) => (
        <button
          key={section.id}
          type="button"
          onClick={() => navigate(section.id)}
          aria-current={active === section.id ? "page" : undefined}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
            active === section.id
              ? "bg-violet-600 text-white"
              : "text-slate-300 hover:bg-slate-800 hover:text-white"
          }`}
        >
          {section.label}
        </button>
      ))}
    </nav>
  );
}
