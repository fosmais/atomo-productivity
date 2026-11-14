"use client";

import { ReactNode, useEffect, useState } from "react";
import VyraNavigation from "./vyra-navigation";
import VyraHeader from "./vyra-header";
import MykaSupport from "./myka-support";
import EventReminders from "./event-reminders";
import { VyraModuleContext, VyraNavigationContext } from "./vyra-module-context";

type VyraWorkspaceProps = {
  children: ReactNode;
};

export default function VyraWorkspace({
  children,
}: VyraWorkspaceProps) {
  const [activeModule, setActiveModule] = useState("home");
  useEffect(() => {
    const themes: Record<string, string> = { violet: "linear-gradient(160deg, #0b061e, #020617 65%)", flow: "linear-gradient(160deg, #081321, #030816 70%)", navy: "linear-gradient(160deg, #071a32, #020617 65%)", graphite: "linear-gradient(160deg, #15151d, #020617 65%)" };
    try { const theme = localStorage.getItem("myryra:background-theme:v1") || "flow"; const root = document.getElementById("dashboard-top")?.parentElement; if (root) root.style.background = themes[theme] || themes.flow; } catch { /* optional */ }
  }, []);
  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null);
  const [quickAction, setQuickAction] = useState<string | null>(null);

  const validModules = [
    "home", "vyra-ai", "vyra-planner", "vyra-tasks", "vyra-calendar",
    "vyra-scheduling", "vyra-performance", "vyra-finance", "vyra-health", "vyra-settings",
  ];

  // Persist the active workspace section in the URL so refresh and browser
  // navigation preserve the user's context without relying on local storage.
  useEffect(() => {
    const syncFromUrl = () => {
      const requested = decodeURIComponent(window.location.hash.slice(1));
      setActiveModule(requested === "vyra-planner" ? "vyra-tasks" : validModules.includes(requested) ? requested : "home");
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    };
    syncFromUrl();
    window.addEventListener("hashchange", syncFromUrl);
    return () => window.removeEventListener("hashchange", syncFromUrl);
  }, []);

  const navigateTo = (module: string) => {
    setActiveModule(module);
    // Reset the scroll position when changing sections, including returning Home.
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    const url = new URL(window.location.href);
    url.hash = module === "home" ? "" : module;
    window.history.replaceState(window.history.state, "", url.toString());
  };

  const navigateToQuickAction = (action: string) => {
    setQuickAction(action);
    navigateTo("vyra-tasks");
  };

  const navigateToTask = (taskId: string) => {
    setFocusedTaskId(taskId);
    navigateTo("vyra-tasks");
  };



  return (
    <VyraNavigationContext.Provider value={{ activeModule, navigateTo, focusedTaskId, navigateToTask, quickAction, navigateToQuickAction }}>
    <VyraModuleContext.Provider value={activeModule}>
    <div className="min-w-0 pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-0">
      <div className={activeModule === "home" ? "mb-3" : "mb-6"}><VyraHeader /></div>


      <div className="lg:grid lg:grid-cols-[200px_minmax(0,1fr)] lg:items-start lg:gap-6">
        <VyraNavigation
          activeModule={activeModule}
          onModuleChange={navigateTo}
        />

        <div className="min-w-0">
          {activeModule === "vyra-calendar" && <div className="mb-3 rounded-xl border border-white/10 bg-slate-900/70 p-3"><EventReminders showControls /></div>}
          {activeModule !== "vyra-calendar" && <EventReminders />}
          {children}
        </div>
      </div>
      <MykaSupport />
    </div>
    </VyraModuleContext.Provider>
    </VyraNavigationContext.Provider>
  );
}