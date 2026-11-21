"use client";

import type { ReactNode } from "react";
import { useVyraActiveModule } from "./vyra-module-context";

type VyraModuleProps = {
  id: string;
  children: ReactNode;
};

export default function VyraModule({
  id,
  children,
}: VyraModuleProps) {
  const activeModule = useVyraActiveModule();

  if (activeModule !== null && activeModule !== id) {
    return null;
  }

  return (
    <div data-vyra-module={id} className="min-w-0">
      {children}
    </div>
  );
}