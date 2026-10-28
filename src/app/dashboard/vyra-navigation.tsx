"use client";

import { useState } from "react";

const primaryItems = [
  { id: "home", label: "Hoje", icon: "⌂" },
  { id: "vyra-tasks", label: "Tarefas", icon: "✓" },
  { id: "vyra-calendar", label: "Agenda", icon: "▦" },
  { id: "vyra-ai", label: "Myka AI", icon: "✦" },
];

const secondaryItems = [
  { id: "vyra-planner", label: "Planner", icon: "◷" },
  { id: "vyra-scheduling", label: "Smart Scheduling", icon: "⚡" },
  { id: "vyra-performance", label: "Performance", icon: "◈" },
  { id: "vyra-settings", label: "Preferências", icon: "⚙" },
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
    item: { id: string; label: string; icon: string }
  ) {
    const selected = current === item.id;

    return (
      <button
        key={item.id}
        type="button"
        onClick={() => navigateTo(item.id)}
        aria-current={selected ? "page" : undefined}
        className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-[11px] font-medium transition-colors lg:w-full lg:flex-row lg:justify-start lg:gap-3 lg:px-3 lg:py-3 lg:text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400 ${
          selected
            ? "bg-violet-600 text-white shadow-lg shadow-violet-500/20"
            : "text-slate-400 hover:bg-violet-500/10 hover:text-white"
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
        className="fixed inset-x-0 bottom-0 z-40 border-t border-violet-400/20 bg-slate-950/95 px-2 pb-[env(safe-area-inset-bottom)] pt-2 shadow-2xl shadow-violet-950/40 backdrop-blur-xl lg:sticky lg:top-6 lg:inset-x-auto lg:bottom-auto lg:w-full lg:rounded-2xl lg:border lg:border-white/10 lg:bg-slate-950/80 lg:p-3"
      >
        <div className="grid grid-cols-4 gap-1 lg:grid-cols-1">
          {primaryItems.map(navigationButton)}
        </div>

        <div className="hidden border-t border-white/10 pt-2 lg:mt-2 lg:block">
          <button
            type="button"
            onClick={() => setMoreOpen((value) => !value)}
            aria-expanded={moreOpen || secondaryActive}
            aria-controls="vyra-secondary-navigation"
            className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-sm font-medium text-slate-300 hover:bg-violet-500/10"
          >
            <span>Mais ferramentas</span>
            <span aria-hidden="true">
              {moreOpen || secondaryActive ? "⌃" : "⌄"}
            </span>
          </button>

          <div
            id="vyra-secondary-navigation"
            className={
              moreOpen || secondaryActive
                ? "grid grid-cols-1 gap-1 pb-1"
                : "hidden"
            }
          >
            {secondaryItems.map(navigationButton)}
          </div>
        </div>
      </nav>

      <div className="mb-4 lg:hidden">
        <button
          type="button"
          onClick={() => setMoreOpen((value) => !value)}
          aria-expanded={moreOpen || secondaryActive}
          aria-controls="vyra-mobile-tools"
          className="flex w-full items-center justify-between rounded-xl border border-violet-400/20 bg-violet-500/10 px-4 py-3 text-sm font-medium text-violet-200"
        >
          <span>Mais ferramentas</span>
          <span aria-hidden="true">
            {moreOpen || secondaryActive ? "⌃" : "⌄"}
          </span>
        </button>

        <div
          id="vyra-mobile-tools"
          className={
            moreOpen || secondaryActive
              ? "mt-2 grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-slate-950/80 p-2"
              : "hidden"
          }
        >
          {secondaryItems.map(navigationButton)}
        </div>
      </div>
    </>
  );
}