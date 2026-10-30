"use client";

import { Children, isValidElement, ReactNode, useEffect, useState } from "react";
import VyraNavigation from "./vyra-navigation";
import VyraHeader from "./vyra-header";
import { VyraModuleContext, VyraNavigationContext } from "./vyra-module-context";

type VyraWorkspaceProps = {
  children: ReactNode;
};

export default function VyraWorkspace({
  children,
}: VyraWorkspaceProps) {
  const [activeModule, setActiveModule] = useState("home");
  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null);

  const validModules = [
    "home", "vyra-ai", "vyra-planner", "vyra-tasks", "vyra-calendar",
    "vyra-scheduling", "vyra-performance", "vyra-settings",
  ];

  // Persist the active workspace section in the URL so refresh and browser
  // navigation preserve the user's context without relying on local storage.
  useEffect(() => {
    const syncFromUrl = () => {
      const requested = decodeURIComponent(window.location.hash.slice(1));
      setActiveModule(validModules.includes(requested) ? requested : "home");
    };
    syncFromUrl();
    window.addEventListener("hashchange", syncFromUrl);
    return () => window.removeEventListener("hashchange", syncFromUrl);
  }, []);

  const navigateTo = (module: string) => {
    setActiveModule(module);
    const url = new URL(window.location.href);
    url.hash = module === "home" ? "" : module;
    window.history.replaceState(window.history.state, "", url.toString());
  };

  const navigateToTask = (taskId: string) => {
    setFocusedTaskId(taskId);
    navigateTo("vyra-tasks");
  };

  const moduleTitles: Record<string, string> = {
    home: "Seu espaço inteligente",
    "vyra-ai": "Myka AI",
    "vyra-planner": "Planner",
    "vyra-tasks": "Tarefas",
    "vyra-calendar": "Agenda",
    "vyra-scheduling": "Smart Scheduling",
    "vyra-performance": "Performance",
    "vyra-settings": "Preferências",
  };

  return (
    <VyraNavigationContext.Provider value={{ activeModule, navigateTo, focusedTaskId, navigateToTask }}>
    <VyraModuleContext.Provider value={activeModule}>
    <div className="min-w-0 pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-0">
      <div className="mb-6"><VyraHeader /></div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-violet-400">
            MYRYRA WORKSPACE
          </p>

          <h2 className="mt-2 text-2xl font-semibold text-white">
            {moduleTitles[activeModule] ?? "MYRYRA"}
          </h2>
        </div>
      </div>

      <div className="lg:grid lg:grid-cols-[200px_minmax(0,1fr)] lg:items-start lg:gap-6">
        <VyraNavigation
          activeModule={activeModule}
          onModuleChange={navigateTo}
        />

        <div className="min-w-0">{children}</div>
      </div>
    </div>
    </VyraModuleContext.Provider>
    </VyraNavigationContext.Provider>
  );
}