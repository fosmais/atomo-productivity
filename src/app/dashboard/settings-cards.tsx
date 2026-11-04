"use client";

import { useEffect, useState, type ReactNode } from "react";

type Section = "appearance" | "security" | "integrations" | "data";
const sections: { id: Section; icon: string; title: string; description: string }[] = [
  { id: "appearance", icon: "◐", title: "Aparência", description: "Cores e personalização" },
  { id: "security", icon: "◇", title: "Conta e segurança", description: "Senha e proteção" },
  { id: "integrations", icon: "▦", title: "Integrações", description: "Calendário e aplicativos" },
  { id: "data", icon: "✦", title: "Dados e suporte", description: "Lixeira e feedback" },
];

export default function SettingsCards({ appearance, security, integrations, data, footer }: {
  appearance: ReactNode; security: ReactNode; integrations: ReactNode; data: ReactNode; footer: ReactNode;
}) {
  const [active, setActive] = useState<Section | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("google_calendar")) setActive("integrations");
  }, []);
  const panels = { appearance, security, integrations, data };
  return <div className="mx-auto w-full max-w-5xl space-y-4">
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Categorias de preferências">
      {sections.map(section => <button key={section.id} type="button" aria-expanded={active === section.id} onClick={() => setActive(current => current === section.id ? null : section.id)}
        className={`flex min-h-32 flex-col items-start justify-between gap-3 rounded-2xl border p-4 text-left transition focus-visible:outline-2 focus-visible:outline-violet-400 ${active === section.id ? "border-violet-400 bg-violet-500/15 shadow-lg shadow-violet-950/20" : "border-white/15 bg-slate-900/75 hover:border-violet-400/50"}`}>
        <span className="text-2xl text-violet-300" aria-hidden="true">{section.icon}</span>
        <span className="block"><span className="block text-sm font-semibold text-white">{section.title}</span><span className="mt-1 block text-xs leading-relaxed text-slate-400">{section.description}</span></span>
      </button>)}
    </div>
    {active && <section className="min-w-0 rounded-2xl border border-violet-400/30 bg-slate-950/35 p-3 sm:p-5" aria-label={sections.find(item => item.id === active)?.title}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-white">{sections.find(item => item.id === active)?.title}</h3>
        <button type="button" onClick={() => setActive(null)} className="rounded-lg border border-white/20 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/10">Fechar</button>
      </div>
      {panels[active]}
    </section>}
    <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-4">{footer}</div>
  </div>;
}
