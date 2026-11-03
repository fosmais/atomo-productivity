"use client";

import { useMemo, useState } from "react";
import { useVyraNavigation } from "./vyra-module-context";

const format = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
const number = (input: string) => Number(input.trim().replace(",", "."));

export default function FinanceInvestments() {
  const { navigateTo } = useVyraNavigation();
  const [handoffError, setHandoffError] = useState(false);
  const [initial, setInitial] = useState("1000");
  const [monthly, setMonthly] = useState("200");
  const [rate, setRate] = useState("10");
  const [years, setYears] = useState("5");
  const [ratePeriod, setRatePeriod] = useState<"annual" | "monthly">("annual");
  const result = useMemo(() => {
    const principal = number(initial);
    const contribution = number(monthly);
    const interest = number(rate);
    const duration = number(years);
    if (![principal, contribution, interest, duration].every(Number.isFinite) ||
      principal < 0 || contribution < 0 || principal > 1e10 || contribution > 1e9 ||
      interest < 0 || interest > 100 || !Number.isInteger(duration) || duration < 1 || duration > 50) return null;
    const monthlyRate = ratePeriod === "annual" ? Math.pow(1 + interest / 100, 1 / 12) - 1 : interest / 100;
    const months = duration * 12;
    let balance = principal;
    const checkpoints: { year: number; balance: number }[] = [];
    for (let month = 1; month <= months; month++) {
      balance = balance * (1 + monthlyRate) + contribution;
      if (!Number.isFinite(balance) || balance > 1e15) return null;
      if (month % 12 === 0) checkpoints.push({ year: month / 12, balance });
    }
    const invested = principal + contribution * months;
    return { balance, invested, gain: balance - invested, checkpoints };
  }, [initial, monthly, rate, years, ratePeriod]);

  function askMyka() {
    const prompt = `MYKA, quero planejar meus investimentos para alcançar meu objetivo. Meu valor inicial simulado é R$ ${initial}, aporte mensal R$ ${monthly}, taxa hipotética ${rate}% ${ratePeriod === "annual" ? "ao ano" : "ao mês"} e prazo de ${years} anos. Antes de comparar opções como Tesouro Direto, CDB e fundos, pergunte meu objetivo, necessidade de liquidez, reserva de emergência, tolerância a perdas e experiência. Explique riscos, custos, impostos e diferenças, sem prometer ganhos ou indicar uma opção como a melhor sem conhecer meu perfil.`;
    try {
      sessionStorage.setItem("myryra:myka:investment-handoff", prompt);
      setHandoffError(false);
      navigateTo("vyra-ai");
    } catch {
      setHandoffError(true);
    }
  }

  return <section className="min-w-0 space-y-4 rounded-2xl border border-violet-400/25 bg-slate-900/75 p-4 sm:p-6" aria-label="Simulador de investimentos">
    <div>
      <p className="text-xs font-semibold uppercase tracking-widest text-violet-300">MYRYRA Finance · Investimentos</p>
      <h3 className="mt-2 text-xl font-semibold text-white">Projete o crescimento do seu dinheiro</h3>
      <p className="mt-1 text-sm text-slate-400">Simulação de juros compostos com aportes no final de cada mês. Os valores não representam investimentos reais.</p>
    </div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <label className="text-sm text-slate-300">Valor inicial (R$)
        <input aria-label="Valor inicial em reais" inputMode="decimal" value={initial} onChange={e => setInitial(e.target.value)} className="mt-1 w-full rounded-xl border border-white/20 bg-slate-950 p-3 text-white" />
      </label>
      <label className="text-sm text-slate-300">Aporte mensal (R$)
        <input aria-label="Aporte mensal em reais" inputMode="decimal" value={monthly} onChange={e => setMonthly(e.target.value)} className="mt-1 w-full rounded-xl border border-white/20 bg-slate-950 p-3 text-white" />
      </label>
      <label className="text-sm text-slate-300">Taxa de juros (%)
        <input aria-label="Taxa de juros percentual" inputMode="decimal" value={rate} onChange={e => setRate(e.target.value)} className="mt-1 w-full rounded-xl border border-white/20 bg-slate-950 p-3 text-white" />
      </label>
      <label className="text-sm text-slate-300">Período da taxa
        <select value={ratePeriod} onChange={e => setRatePeriod(e.target.value as "annual" | "monthly")} className="mt-1 w-full rounded-xl border border-white/20 bg-slate-950 p-3 text-white"><option value="annual">Ao ano (efetiva)</option><option value="monthly">Ao mês</option></select>
      </label>
      <label className="text-sm text-slate-300">Prazo (anos)
        <input aria-label="Prazo em anos" type="number" min="1" max="50" step="1" value={years} onChange={e => setYears(e.target.value)} className="mt-1 w-full rounded-xl border border-white/20 bg-slate-950 p-3 text-white" />
      </label>
    </div>
    {!result ? <p role="alert" className="text-sm text-rose-300">Confira os valores. O prazo deve ser de 1 a 50 anos e a taxa de 0% a 100% por período.</p> : <>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-white/15 bg-slate-950/60 p-4"><p className="text-sm text-slate-400">Total investido</p><p className="mt-2 text-xl font-semibold text-white">{format(result.invested)}</p></div>
        <div className="rounded-xl border border-emerald-400/20 bg-slate-950/60 p-4"><p className="text-sm text-slate-400">Rendimento projetado</p><p className="mt-2 text-xl font-semibold text-emerald-300">{format(result.gain)}</p></div>
        <div className="rounded-xl border border-violet-400/30 bg-violet-950/30 p-4"><p className="text-sm text-slate-300">Patrimônio projetado</p><p className="mt-2 text-xl font-semibold text-white">{format(result.balance)}</p></div>
      </div>
      <div className="rounded-xl border border-white/10 bg-slate-950/40 p-4">
        <h4 className="mb-3 text-sm font-semibold text-white">Evolução estimada por ano</h4>
        <div className="flex h-36 items-end gap-1 overflow-x-auto" role="img" aria-label="Gráfico de evolução anual do patrimônio projetado">
          {result.checkpoints.map(point => <div key={point.year} className="group flex h-full min-w-3 flex-1 flex-col justify-end" title={`Ano ${point.year}: ${format(point.balance)}`}>
            <div className="w-full rounded-t bg-violet-500/80" style={{ height: `${Math.max(2, point.balance / Math.max(result.balance, 1) * 100)}%` }} />
          </div>)}
        </div>
        <div className="mt-2 flex justify-between text-xs text-slate-400"><span>Ano 1</span><span>Ano {years}</span></div>
      </div>
    </>}
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-violet-400/40 bg-gradient-to-r from-violet-950/60 to-slate-950/70 p-4 sm:p-5">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-widest text-violet-300">✦ MYKA · Planejamento inteligente</p>
        <h4 className="mt-1 text-lg font-semibold text-white">Qual investimento combina com seu objetivo?</h4>
        <p className="mt-1 max-w-xl text-sm text-slate-300">Converse com a MYKA para comparar alternativas, riscos, prazos e liquidez de acordo com suas necessidades.</p>
      </div>
      <button type="button" onClick={askMyka} className="rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white hover:bg-violet-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300">Perguntar à MYKA</button>
      {handoffError && <p role="alert" className="w-full text-xs text-rose-300">Não foi possível transferir a simulação para a MYKA. Verifique as permissões de armazenamento do navegador.</p>}
    </div>
    <p className="text-xs leading-5 text-slate-400">A MYKA oferece informações educativas e comparações, não consultoria individualizada nem recomendação de compra. Consulte um profissional habilitado para decisões personalizadas.</p>
    <p className="text-xs leading-5 text-slate-400">Projeção matemática ilustrativa com taxa constante e capitalização mensal. Não considera impostos, inflação, tarifas, volatilidade ou risco de perda. Rentabilidade futura não é garantida. Nenhum dinheiro é investido pela MYRYRA.</p>
  </section>;
}
