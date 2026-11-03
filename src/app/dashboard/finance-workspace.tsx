"use client";

import { useState } from "react";
import MyryraFinanceStarter from "./myryra-finance-starter";
import FinancePlanning from "./finance-planning";
import FinanceSubscriptions from "./finance-subscriptions";
import FinanceInvestments from "./finance-investments";

const sections = [
  { id: "overview", label: "Visão geral", description: "Saldo e movimentações" },
  { id: "planning", label: "Planejamento", description: "Metas e despesas" },
  { id: "forecast", label: "Projeções", description: "Assinaturas e cenários" },
  { id: "investments", label: "Investimentos", description: "Simulador educativo" },
] as const;
type Section = typeof sections[number]["id"];

export default function FinanceWorkspace() {
  const [active, setActive] = useState<Section>("overview");
  return (
    <div className="min-w-0 space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="tablist" aria-label="Áreas financeiras">
        {sections.map(section => (
          <button key={section.id} type="button" role="tab" id={"finance-tab-"+section.id}
            aria-selected={active === section.id} aria-controls={"finance-panel-"+section.id}
            onClick={() => setActive(section.id)}
            className={"min-w-0 rounded-xl border p-3 text-left sm:p-4 transition-colors focus-visible:outline-2 focus-visible:outline-violet-400 " +
              (active === section.id ? "border-violet-400/70 bg-violet-600/25 text-white" : "border-white/15 bg-slate-900/70 text-slate-200 hover:border-violet-400/40")}>
            <span className="block text-sm font-semibold">{section.label}</span>
            <span className="mt-1 hidden text-xs text-slate-400 lg:block">{section.description}</span>
          </button>
        ))}
      </div>
      <div className="min-w-0 rounded-2xl border border-white/10 bg-slate-950/40 p-3 sm:p-5" role="tabpanel" id={"finance-panel-"+active} aria-labelledby={"finance-tab-"+active}>
        {active === "overview" && <MyryraFinanceStarter />}
        {active === "planning" && <FinancePlanning />}
        {active === "forecast" && <FinanceSubscriptions />}
        {active === "investments" && <FinanceInvestments />}
      </div>
    </div>
  );
}
