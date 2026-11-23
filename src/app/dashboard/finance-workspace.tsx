"use client";

import { useState } from "react";
import MyryraFinanceStarter from "./myryra-finance-starter";
import FinancePlanning from "./finance-planning";
import FinanceSubscriptions from "./finance-subscriptions";
import FinanceInvestments from "./finance-investments";
import FinanceCsvImport from "./finance-csv-import";
import FinanceMonthlySummary from "./finance-monthly-summary";

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
      <div className="rounded-2xl border border-violet-400/25 bg-gradient-to-r from-violet-950/40 to-slate-900/70 p-4 sm:p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-violet-300">MYRYRA Finance · Fase 1</p>
        <h3 className="mt-1 text-lg font-semibold text-white">Seu dinheiro, suas decisões.</h3>
        <p className="mt-2 text-sm leading-6 text-slate-300">Organize saldos e movimentações manuais, acompanhe metas, planeje despesas e simule cenários. Comece por Visão geral para registrar sua situação atual.</p>
        <details className="mt-3 text-sm text-slate-300">
          <summary className="cursor-pointer font-medium text-violet-200">O que posso fazer em cada área?</summary>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <p><strong className="text-white">Visão geral:</strong> saldos, lançamentos e importação de extratos.</p>
            <p><strong className="text-white">Planejamento:</strong> metas financeiras e despesas previstas.</p>
            <p><strong className="text-white">Projeções:</strong> assinaturas recorrentes e cenários futuros.</p>
            <p><strong className="text-white">Investimentos:</strong> simulações educativas de juros e aportes.</p>
          </div>
        </details>
        <p className="mt-3 text-xs text-slate-400">A MYRYRA não é banco, não movimenta dinheiro nem executa investimentos nesta fase.</p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="tablist" aria-label="Áreas financeiras">
        {sections.map(section => (
          <button key={section.id} type="button" role="tab" id={"finance-tab-"+section.id}
            aria-selected={active === section.id} tabIndex={active === section.id ? 0 : -1} aria-controls={"finance-panel-"+section.id}
            onClick={() => setActive(section.id)}
            onKeyDown={event => {
              const index = sections.findIndex(item => item.id === active);
              const next = event.key === "ArrowRight" ? (index + 1) % sections.length : event.key === "ArrowLeft" ? (index - 1 + sections.length) % sections.length : -1;
              if (next >= 0) {
                event.preventDefault();
                setActive(sections[next].id);
                document.getElementById("finance-tab-" + sections[next].id)?.focus();
              }
            }}
            className={"min-w-0 rounded-xl border p-3 text-left sm:p-4 transition-colors focus-visible:outline-2 focus-visible:outline-violet-400 " +
              (active === section.id ? "border-violet-400/70 bg-violet-600/25 text-white" : "border-white/15 bg-slate-900/70 text-slate-200 hover:border-violet-400/40")}>
            <span className="block text-sm font-semibold">{section.label}</span>
            <span className="mt-1 hidden text-xs text-slate-400 lg:block">{section.description}</span>
          </button>
        ))}
      </div>
      <div className="min-w-0 rounded-2xl border border-white/10 bg-slate-950/40 p-3 sm:p-5" role="tabpanel" id={"finance-panel-"+active} aria-labelledby={"finance-tab-"+active} tabIndex={0}>
        {active === "overview" && <div className="space-y-4"><FinanceMonthlySummary /><MyryraFinanceStarter /><FinanceCsvImport /></div>}
        {active === "planning" && <FinancePlanning />}
        {active === "forecast" && <FinanceSubscriptions />}
        {active === "investments" && <FinanceInvestments />}
      </div>
    </div>
  );
}
