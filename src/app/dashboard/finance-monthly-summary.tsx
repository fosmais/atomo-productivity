"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Entry = { amount_cents: number; kind: "income" | "expense"; created_at: string };
const money = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value / 100);
export default function FinanceMonthlySummary() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [bills, setBills] = useState<{ amount_cents: number; due_date: string; paid_at: string | null }[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true); setError("");
      try {
        const client = createClient();
        const { data: auth, error: authError } = await client.auth.getUser();
        if (authError || !auth.user) throw new Error("Faça login para consultar os gráficos.");
        const { data, error: queryError } = await client.from("myryra_finance_entries")
          .select("amount_cents,kind,created_at").eq("user_id", auth.user.id).order("created_at", { ascending: false }).limit(1000);
        if (queryError) throw queryError;
        if (alive) setEntries((data ?? []) as Entry[]);
        const { data: billData, error: billError } = await client.from("myryra_finance_planned_expenses").select("amount_cents,due_date,paid_at").eq("user_id", auth.user.id).limit(1000);
        if (billError) throw billError;
        if (alive) setBills(billData ?? []);
      } catch (cause) { if (alive) setError(cause instanceof Error ? cause.message : "Não foi possível carregar os dados."); }
      finally { if (alive) setLoading(false); }
    }
    const refresh = () => void load();
    void load();
    window.addEventListener("myryra:finance-updated", refresh);
    return () => { alive = false; window.removeEventListener("myryra:finance-updated", refresh); };
  }, []);
  const months = useMemo(() => Array.from({ length: 6 }, (_, i) => {
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - (5 - i));
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const items = entries.filter(e => e.created_at.slice(0, 7) === key);
    return { key, label: new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(d), income: items.filter(e => e.kind === "income").reduce((s, e) => s + Number(e.amount_cents), 0), expense: items.filter(e => e.kind === "expense").reduce((s, e) => s + Number(e.amount_cents), 0) };
  }), [entries]);
  const current = months[5];
  const currentKey = current.key;
  const monthlyBills = bills.filter(bill => bill.due_date.slice(0, 7) === currentKey);
  const paidBills = monthlyBills.filter(bill => bill.paid_at).reduce((sum, bill) => sum + Number(bill.amount_cents), 0);
  const pendingBills = monthlyBills.filter(bill => !bill.paid_at).reduce((sum, bill) => sum + Number(bill.amount_cents), 0);
  const max = Math.max(1, ...months.flatMap(m => [m.income, m.expense]));
  return <section className="rounded-2xl border border-violet-400/25 bg-slate-900/75 p-4 sm:p-5" aria-label="Resumo financeiro mensal">
    <h3 className="font-semibold text-white">Seu mês em números</h3>
    <p className="mt-1 text-xs text-slate-400">Receitas e despesas registradas manualmente. Os valores não comprovam pagamento e não incluem saldo inicial ou rendimentos de investimentos.</p>
    {loading ? <p className="mt-3 text-sm text-slate-400">Carregando gráfico...</p> : error ? <p role="alert" className="mt-3 text-sm text-red-300">{error}</p> : <>
      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-lg bg-emerald-500/10 p-3"><p className="text-emerald-200">Entradas do mês</p><strong className="text-white">{money(current.income)}</strong></div>
        <div className="rounded-lg bg-rose-500/10 p-3"><p className="text-rose-200">Saídas do mês</p><strong className="text-white">{money(current.expense)}</strong></div>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-sm"><div className="rounded-lg bg-slate-800/70 p-3"><p className="text-slate-300">Contas pagas</p><strong className="text-white">{money(paidBills)}</strong></div><div className="rounded-lg bg-amber-500/10 p-3"><p className="text-amber-200">Contas pendentes</p><strong className="text-white">{money(pendingBills)}</strong></div></div>
      <div className="mt-4 space-y-3" role="img" aria-label="Comparação das receitas e despesas registradas nos últimos seis meses">
        {months.map(month => <div key={month.key} className="grid grid-cols-[3rem_1fr] items-center gap-3 text-xs text-slate-300">
          <span>{month.label}</span><div className="space-y-1">
            <div className="h-3 rounded bg-slate-800"><div className="h-full rounded bg-emerald-500" style={{ width: `${month.income / max * 100}%` }} title={`Entradas: ${money(month.income)}`} /></div>
            <div className="h-3 rounded bg-slate-800"><div className="h-full rounded bg-violet-500" style={{ width: `${month.expense / max * 100}%` }} title={`Saídas: ${money(month.expense)}`} /></div>
          </div>
        </div>)}
      </div>
      <p className="mt-3 text-xs text-slate-400">Verde: entradas · Roxo: saídas. Contas pagas e pendentes usam as despesas planejadas e a confirmação manual; não representam conciliação bancária. Investimentos simulados não são patrimônio real.</p>
    </>}
  </section>;
}
