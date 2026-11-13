"use client";

import { useState } from "react";
import Link from "next/link";

const primaryItems = [
  { id: "home", label: "Hoje", icon: "⌂", hint: "Resumo e prioridades do dia" },
  { id: "vyra-ai", label: "MIKA", icon: "✦", hint: "Sua assistente inteligente" },
  { id: "journey", label: "Jornadas", icon: "◈", hint: "Suas metas e missões" },
  { id: "spaces", label: "Espaços", icon: "▦", hint: "Todas as ferramentas" },
];

const secondaryItems = [
  { id: "vyra-tasks", label: "Organizar", icon: "✓" },
  { id: "vyra-calendar", label: "Agenda", icon: "▦" },
  { id: "vyra-performance", label: "Evolução", icon: "◈" },
  { id: "vyra-finance", label: "Finanças", icon: "◇" },
  { id: "vyra-health", label: "Saúde", icon: "♡" },
  { id: "vyra-scheduling", label: "Agendamentos", icon: "⚡" },
  { id: "vyra-settings", label: "Minha conta", icon: "⚙" },
];

type VyraNavigationProps = {
  activeModule?: string;
  onModuleChange?: (module: string) => void;
};

export default function VyraNavigation({
  activeModule,
  onModuleChange,
}: VyraNavigationProps) {
  const [localActive, setLocalActive] = useState("home");
  const [moreOpen, setMoreOpen] = useState(false);

  const current = activeModule ?? localActive;
  const secondaryActive = secondaryItems.some(
    (item) => item.id === current
  );

  function navigateTo(id: string) {
    if (onModuleChange) {
      onModuleChange(id);
    } else {
      setLocalActive(id);
      document.getElementById(id)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }

    setMoreOpen(false);
  }

  function navigationButton(
    item: { id: string; label: string; icon: string; hint?: string }
  ) {
    const selected = item.id === "spaces" ? moreOpen || secondaryActive : current === item.id;
    if (item.id === "journey") return (
      <Link key={item.id} href="/journey" title={item.hint} className="flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-[11px] font-medium text-slate-300 hover:bg-slate-800/80 hover:text-white lg:w-full lg:flex-row lg:justify-start lg:gap-3 lg:px-3 lg:py-3 lg:text-sm focus-visible:outline-2 focus-visible:outline-violet-400"><span className="text-xl" aria-hidden="true">{item.icon}</span><span className="truncate">{item.label}</span></Link>
    );

    return (
      <button
        key={item.id}
        type="button"
        onClick={() => item.id === "spaces" ? setMoreOpen((value) => !value) : navigateTo(item.id)}
        aria-expanded={item.id === "spaces" ? moreOpen : undefined}
        aria-current={selected ? "page" : undefined}
        title={item.hint ?? item.label}
        className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl border border-transparent px-2 py-2 text-[11px] font-medium transition-colors lg:w-full lg:flex-row lg:justify-start lg:gap-3 lg:px-3 lg:py-3 lg:text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400 ${
          selected
            ? "border-violet-400/70 bg-violet-600/20 text-white shadow-sm shadow-violet-950/20"
            : "text-slate-300 hover:border-violet-400/30 hover:bg-slate-800/80 hover:text-white"
        }`}
      >
        <span className="text-xl leading-none lg:text-lg" aria-hidden="true">
          {item.icon}
        </span>
        <span className="truncate">{item.label}</span>
      </button>
    );
  }

  return (
    <>
      <nav
        aria-label="Navegação da MYRYRA"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-violet-400/20 bg-slate-950/95 px-2 pb-[env(safe-area-inset-bottom)] pt-2 shadow-2xl shadow-violet-950/40 backdrop-blur-xl lg:sticky lg:top-6 lg:inset-x-auto lg:bottom-auto lg:w-full lg:rounded-2xl lg:border lg:border-white/15 lg:bg-slate-900/75 lg:p-3"
      >
        <div className="grid grid-cols-4 gap-1.5 lg:grid-cols-1 lg:gap-2">
          {primaryItems.map(navigationButton)}
        </div>

        <div className="hidden border-t border-white/10 pt-2 lg:mt-2 lg:block">
          <button
            type="button"
            onClick={() => setMoreOpen((value) => !value)}
            aria-expanded={moreOpen}
            aria-controls="vyra-secondary-navigation"
            className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-sm font-medium text-slate-300 hover:bg-violet-500/10"
          >
            <span>Espaços</span>
            <span aria-hidden="true">
              {moreOpen ? "⌃" : "⌄"}
            </span>
          </button>

          <div
            id="vyra-secondary-navigation"
            className={
              moreOpen
                ? "grid grid-cols-1 gap-1 pb-1"
                : "hidden"
            }
          >
            <div className="space-y-1">{secondaryItems.map(navigationButton)}            </div>
          </div>
        </div>
      </nav>

      <div className="mb-4 lg:hidden">
        <button
          type="button"
          onClick={() => setMoreOpen((value) => !value)}
          aria-expanded={moreOpen}
          aria-controls="vyra-mobile-tools"
          className="flex w-full items-center justify-between rounded-xl border border-white/15 bg-slate-900/75 px-4 py-3 text-sm font-medium text-violet-200"
        >
          <span>Espaços</span>
          <span aria-hidden="true">
            {moreOpen ? "⌃" : "⌄"}
          </span>
        </button>

        <div
          id="vyra-mobile-tools"
          className={
            moreOpen
              ? "mt-2 flex gap-2 overflow-x-auto rounded-xl border border-white/15 bg-slate-900/75 p-2 snap-x snap-mandatory"
              : "hidden"
          }
        >
          <div className="flex min-w-max gap-2">{secondaryItems.map((item) => (
            <button key={item.id} type="button" onClick={() => navigateTo(item.id)} aria-current={current === item.id ? "page" : undefined} className={`flex min-w-[110px] snap-start flex-col items-center gap-2 rounded-xl border px-3 py-3 text-xs font-medium ${current === item.id ? "border-violet-400 bg-violet-500/20 text-white" : "border-white/10 bg-slate-800/80 text-slate-200"}`}><span aria-hidden="true" className="text-xl">{item.icon}</span>{item.label}</button>
          ))}</div>
        </div>
      </div>
    </>
  );
}