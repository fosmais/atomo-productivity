"use client";

import { createContext, useContext } from "react";

export type VyraNavigationContextValue = {
  activeModule: string;
  navigateTo: (moduleId: string) => void;
  focusedTaskId?: string | null;
  navigateToTask?: (taskId: string) => void;
};

export const VyraModuleContext =
  createContext<string | null>(null);

export const VyraNavigationContext =
  createContext<VyraNavigationContextValue | null>(null);

export function useVyraActiveModule() {
  return useContext(VyraModuleContext);
}

export function useVyraNavigation() {
  const context = useContext(VyraNavigationContext);

  if (!context) {
    throw new Error(
      "useVyraNavigation deve ser utilizado dentro do VyraWorkspace."
    );
  }

  return context;
}