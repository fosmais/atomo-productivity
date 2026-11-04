"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Goal = { id: string; title: string; target_cents: number; saved_cents: number };
type Expense = { id: string; title: string; amount_cents: number; due_date: string; paid_at: string | null };
const money = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n / 100);
function parseCents(input: string) {
  const raw = input.trim().replace(/^R\$\s*/i, "").replace(/\s/g, "");
  if (!raw) return null;
  // Accept pt-BR currency (7.000,00), plain digits (7000) and decimals (7000.00).
  // Never guess ambiguous grouping such as 7,000 or 7.000: treat those as
  // thousands only when exactly three digits follow the separator.
  let normalized: string;
  if (/^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(raw)) {
    normalized = raw.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?$/.test(raw)) {
    normalized = raw.replace(/,/g, "");
  } else if (/^\d+(?:[.,]\d{1,2})?$/.test(raw)) {
    normalized = raw.replace(",", ".");
  } else {
    return null;
  }
  const [integer, fraction = ""] = normalized.split(".");
  const cents = Number(integer) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(cents) && cents > 0 && cents <= 100000000000 ? cents : null;
}

export default function FinancePlanning() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [goalTitle, setGoalTitle] = useState("");
  const [goalAmount, setGoalAmount] = useState("");
  const [expenseTitle, setExpenseTitle] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const plannedTotal = useMemo(() => expenses.filter(item => !item.paid_at).reduce((sum, item) => sum + Number(item.amount_cents), 0), [expenses]);
  const paidTotal = useMemo(() => expenses.filter(item => item.paid_at).reduce((sum, item) => sum + Number(item.amount_cents), 0), [expenses]);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const client = createClient();
        const { data: auth, error: authError } = await client.auth.getUser();
        if (authError || !auth.user) throw new Error("Autenticação necessária");
        const [goalResult, expenseResult] = await Promise.all([
          client.from("myryra_finance_goals").select("id,title,target_cents,saved_cents").eq("user_id", auth.user.id).order("created_at", { ascending: false }).limit(100),
          client.from("myryra_finance_planned_expenses").select("id,title,amount_cents,due_date,paid_at").eq("user_id", auth.user.id).order("due_date", { ascending: true }).limit(200)
        ]);
        if (goalResult.error || expenseResult.error) throw new Error("Falha na consulta");
        if (active) { setGoals((goalResult.data ?? []) as Goal[]); setExpenses((expenseResult.data ?? []) as Expense[]); }
      } catch { if (active) setError("Não foi possível carregar seu planejamento."); }
      finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, []);

  async function addGoal(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cents = parseCents(goalAmount);
    if (!cents || !goalTitle.trim() || goalTitle.trim().length > 100) { setError("Informe uma meta e um valor válido."); return; }
    setBusy(true); setError("");
    try {
      const client = createClient();
      const { data: auth, error: authError } = await client.auth.getUser();
      if (authError || !auth.user) throw new Error("Autenticação necessária");
      const { data, error: insertError } = await client.from("myryra_finance_goals").insert({ user_id: auth.user.id, title: goalTitle.trim(), target_cents: cents }).select("id,title,target_cents,saved_cents").single();
      if (insertError) throw insertError;
      setGoals(previous => [data as Goal, ...previous]); setGoalTitle(""); setGoalAmount("");
    } catch { setError("Não foi possível salvar a meta."); }
    finally { setBusy(false); }
  }

  async function addExpense(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cents = parseCents(expenseAmount);
    if (!cents || !expenseTitle.trim() || expenseTitle.trim().length > 100 || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(expenseDate)) {
      setError("Informe despesa, valor e data válidos."); return;
    }
    setBusy(true); setError("");
    try {
      const client = createClient();
      const { data: auth, error: authError } = await client.auth.getUser();
      if (authError || !auth.user) throw new Error("Autenticação necessária");
      const { data, error: insertError } = await client.from("myryra_finance_planned_expenses").insert({ user_id: auth.user.id, title: expenseTitle.trim(), amount_cents: cents, due_date: expenseDate }).select("id,title,amount_cents,due_date").single();
      if (insertError) throw insertError;
      setExpenses(previous => [...previous, data as Expense].sort((a, b) => a.due_date.localeCompare(b.due_date)));
      setExpenseTitle(""); setExpenseAmount(""); setExpenseDate("");
    } catch { setError("Não foi possível salvar a despesa planejada."); }
    finally { setBusy(false); }
  }

  async function togglePaid(expense: Expense) {
    setBusy(true); setError("");
    try {
      const client = createClient();
      const { data: auth, error: authError } = await client.auth.getUser();
      if (authError || !auth.user) throw new Error("Faça login novamente.");
      const paid_at = expense.paid_at ? null : new Date().toISOString();
      const { data, error: updateError } = await client.from("myryra_finance_planned_expenses")
        .update({ paid_at }).eq("id", expense.id).eq("user_id", auth.user.id)
        .select("id,paid_at").single();
      if (updateError) throw updateError;
      if (!data) throw new Error("A alteração não foi confirmada.");
      setExpenses(previous => previous.map(item => item.id === expense.id ? { ...item, paid_at: data.paid_at } : item));
      window.dispatchEvent(new Event("myryra:finance-updated"));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao atualizar pagamento."); }
    finally { setBusy(false); }
  }

  async function remove(table: "myryra_finance_goals" | "myryra_finance_planned_expenses", id: string) {
    setError("");
    try {
      const client = createClient();
      const { data: auth, error: authError } = await client.auth.getUser();
      if (authError || !auth.user) throw new Error("Sessão expirada.");
      const { data: deleted, error: deleteError } = await client.from(table).delete().eq("id", id).eq("user_id", auth.user.id).select("id");
      if (deleteError) throw deleteError;
      if (!deleted?.length) throw new Error("Registro não encontrado.");
      if (table === "myryra_finance_goals") setGoals(previous => previous.filter(item => item.id !== id));
      else setExpenses(previous => previous.filter(item => item.id !== id));
    } catch { setError("Não foi possível excluir o item."); }
  }

  return <div className="grid min-w-0 gap-4 lg:grid-cols-2">
    <section className="min-w-0 space-y-4 rounded-2xl border border-white/15 bg-slate-900/75 p-4 sm:p-5">
      <div><h3 className="text-lg font-semibold text-white">Metas financeiras</h3><p className="mt-1 text-sm text-slate-400">Planeje objetivos. O valor reservado é informativo e não bloqueia dinheiro.</p></div>
      <form onSubmit={addGoal} className="grid gap-2">
        <input required maxLength={100} aria-label="Nome da meta financeira" placeholder="Ex.: Reserva de emergência" value={goalTitle} onChange={e => setGoalTitle(e.target.value)} className="rounded-xl border border-white/20 bg-slate-950 p-3 text-white" />
        <input required inputMode="decimal" aria-label="Valor da meta em reais" placeholder="Ex.: R$ 10.000,00" value={goalAmount} onChange={e => setGoalAmount(e.target.value)} className="rounded-xl border border-white/20 bg-slate-950 p-3 text-white" />
        <button disabled={busy || loading} className="rounded-xl bg-violet-600 px-4 py-2 font-medium text-white disabled:opacity-50">Criar meta</button>
      </form>
      <ul className="space-y-2">{goals.map(goal => <li key={goal.id} className="flex items-center justify-between gap-2 rounded-xl border border-white/10 p-3"><span className="min-w-0"><span className="block truncate text-sm text-white">{goal.title}</span><span className="text-xs text-slate-400">Objetivo: {money(goal.target_cents)}</span></span><button type="button" onClick={() => void remove("myryra_finance_goals", goal.id)} className="text-xs text-violet-300">Excluir</button></li>)}</ul>
      {!loading && goals.length === 0 && <p className="text-sm text-slate-400">Nenhuma meta cadastrada.</p>}
    </section>
    <section className="min-w-0 space-y-4 rounded-2xl border border-white/15 bg-slate-900/75 p-4 sm:p-5">
      <div><h3 className="text-lg font-semibold text-white">Despesas planejadas</h3><p className="mt-1 text-sm text-slate-400">Previsões futuras, não são descontadas do saldo estimado.</p></div>
      <p className="text-xl font-semibold text-white">{money(plannedTotal)} <span className="text-xs font-normal text-slate-400">em contas pendentes · {money(paidTotal)} pagas</span></p>
      <form onSubmit={addExpense} className="grid gap-2">
        <input required maxLength={100} aria-label="Descrição da despesa planejada" placeholder="Ex.: Aluguel" value={expenseTitle} onChange={e => setExpenseTitle(e.target.value)} className="rounded-xl border border-white/20 bg-slate-950 p-3 text-white" />
        <div className="grid grid-cols-2 gap-2"><input required inputMode="decimal" aria-label="Valor da despesa em reais" placeholder="Ex.: R$ 7.000,00" value={expenseAmount} onChange={e => setExpenseAmount(e.target.value)} className="min-w-0 rounded-xl border border-white/20 bg-slate-950 p-3 text-white" /><input required type="date" aria-label="Data prevista" value={expenseDate} onChange={e => setExpenseDate(e.target.value)} className="min-w-0 rounded-xl border border-white/20 bg-slate-950 p-3 text-white" /></div>
        <button disabled={busy || loading} className="rounded-xl bg-violet-600 px-4 py-2 font-medium text-white disabled:opacity-50">Planejar despesa</button>
      </form>
      <ul className="space-y-2">{expenses.map(expense => <li key={expense.id} className="flex items-center justify-between gap-2 rounded-xl border border-white/10 p-3"><span className="min-w-0"><span className="block truncate text-sm text-white">{expense.title}</span><span className="text-xs text-slate-400">{expense.due_date.split("-").reverse().join("/")} · {money(expense.amount_cents)}</span></span><span className="flex shrink-0 items-center gap-3"><button type="button" disabled={busy} onClick={() => void togglePaid(expense)} className="text-xs text-emerald-300 disabled:opacity-50">{expense.paid_at ? "✓ Paga · Desfazer" : "Marcar paga"}</button><button type="button" onClick={() => void remove("myryra_finance_planned_expenses", expense.id)} className="text-xs text-violet-300">Excluir</button></span></li>)}</ul>
      {!loading && expenses.length === 0 && <p className="text-sm text-slate-400">Nenhuma despesa planejada.</p>}
    </section>
    {error && <p role="alert" className="text-sm text-rose-300 lg:col-span-2">{error}</p>}
  </div>;
}
