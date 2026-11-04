"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useVyraNavigation } from "./vyra-module-context";

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
  const { navigateTo } = useVyraNavigation();
  const [handoffError, setHandoffError] = useState(false);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [goalTitle, setGoalTitle] = useState("");
  const [goalAmount, setGoalAmount] = useState("");
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [savedAmountInput, setSavedAmountInput] = useState("");
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

  function askMykaAboutGoal(goal: Goal) {
    const remaining = Math.max(0, goal.target_cents - goal.saved_cents);
    const prompt = [
      "MIKA, ajude-me a planejar minha meta financeira " + goal.title + ".",
      "Objetivo: " + money(goal.target_cents) + ". Valor reservado manualmente: " + money(goal.saved_cents) + ". Falta: " + money(remaining) + ".",
      "Pergunte sobre meu prazo, capacidade mensal de poupança, reserva de emergência e prioridades antes de propor um plano.",
      "Trate os valores como informações manuais, não como saldo bancário verificado. Não faça alterações automaticamente nem prometa rentabilidade."
    ].join(" ");
    try {
      sessionStorage.setItem("myryra:myka:investment-handoff", prompt);
      setHandoffError(false);
      navigateTo("vyra-ai");
    } catch { setHandoffError(true); }
  }

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

  async function updateGoalSavings(goal: Goal) {
    const cents = /^0(?:[,.]0{1,2})?$/.test(savedAmountInput.trim()) ? 0 : parseCents(savedAmountInput);
    if (cents === null || cents > goal.target_cents) {
      setError("Informe um valor reservado positivo que não ultrapasse o objetivo.");
      return;
    }
    setBusy(true); setError("");
    try {
      const client = createClient();
      const { data: auth, error: authError } = await client.auth.getUser();
      if (authError || !auth.user) throw new Error("Faça login novamente.");
      const { data, error: updateError } = await client.from("myryra_finance_goals")
        .update({ saved_cents: cents }).eq("id", goal.id).eq("user_id", auth.user.id)
        .select("id,saved_cents").single();
      if (updateError || !data) throw new Error(updateError?.message ?? "Falha ao atualizar a meta.");
      setGoals(previous => previous.map(item => item.id === goal.id ? { ...item, saved_cents: Number(data.saved_cents) } : item));
      setEditingGoalId(null); setSavedAmountInput("");
      window.dispatchEvent(new Event("myryra:finance-updated"));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível atualizar a meta."); }
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
      <ul className="space-y-3">{goals.map(goal => <li key={goal.id} className="rounded-xl border border-white/10 p-3">
        <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-medium text-white">{goal.title}</p><p className="mt-1 text-xs text-slate-400">{money(goal.saved_cents)} reservados de {money(goal.target_cents)}</p></div><button type="button" disabled={busy} onClick={() => void remove("myryra_finance_goals", goal.id)} className="text-xs text-violet-300 disabled:opacity-50">Excluir</button></div>
        <div role="progressbar" aria-label={`Progresso da meta ${goal.title}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.round(goal.saved_cents / Math.max(1, goal.target_cents) * 100))} className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-violet-500" style={{ width: `${Math.min(100, goal.saved_cents / Math.max(1, goal.target_cents) * 100)}%` }} /></div>
        <div className="mt-2 flex items-center justify-between gap-2"><span className="text-xs text-slate-400">{Math.round(goal.saved_cents / Math.max(1, goal.target_cents) * 100)}% do objetivo</span><span className="flex flex-wrap items-center gap-3"><button type="button" onClick={() => askMykaAboutGoal(goal)} className="text-xs font-semibold text-emerald-300">Planejar com a MIKA</button><button type="button" disabled={busy} onClick={() => { setEditingGoalId(goal.id); setSavedAmountInput((goal.saved_cents / 100).toFixed(2).replace(".", ",")); }} className="text-xs font-semibold text-violet-200 disabled:opacity-50">Atualizar valor reservado</button></span></div>
        {editingGoalId === goal.id && <div className="mt-3 flex flex-wrap items-end gap-2"><label className="min-w-0 flex-1 text-xs text-slate-300">Total reservado (R$)<input value={savedAmountInput} onChange={e => setSavedAmountInput(e.target.value)} inputMode="decimal" placeholder="Ex.: 1.500,00" className="mt-1 w-full rounded-lg border border-white/20 bg-slate-950 p-2 text-sm text-white" /></label><button type="button" disabled={busy} onClick={() => void updateGoalSavings(goal)} className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Salvar</button><button type="button" onClick={() => setEditingGoalId(null)} className="rounded-lg border border-white/20 px-3 py-2 text-xs text-slate-200">Cancelar</button></div>}
      </li>)}</ul>
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
    {handoffError && <p role="alert" className="text-sm text-rose-300 lg:col-span-2">Não foi possível abrir a MIKA. Tente novamente.</p>}
    {error && <p role="alert" className="text-sm text-rose-300 lg:col-span-2">{error}</p>}
  </div>;
}
