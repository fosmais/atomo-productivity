"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useVyraNavigation } from "./vyra-module-context";

type Goal = { id: string; title: string; target_cents: number; saved_cents: number; priority: "essential" | "important" | "optional" };
type Expense = { id: string; title: string; amount_cents: number; due_date: string; paid_at: string | null };
const money = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n / 100);
function parseCents(input: string, allowZero = false) {
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
  return Number.isSafeInteger(cents) && (allowZero ? cents >= 0 : cents > 0) && cents <= 100000000000 ? cents : null;
}

export default function FinancePlanning() {
  const { navigateTo } = useVyraNavigation();
  const [handoffError, setHandoffError] = useState(false);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [goalTitle, setGoalTitle] = useState("");
  const [goalAmount, setGoalAmount] = useState("");
  const [newGoalPriority, setNewGoalPriority] = useState<"essential" | "important" | "optional">("important");
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [savedAmountInput, setSavedAmountInput] = useState("");
  const [goalHorizonMonths, setGoalHorizonMonths] = useState(12);
  const [goalSort, setGoalSort] = useState<"remaining" | "progress" | "name" | "priority">("remaining");
  const [goalPriorities, setGoalPriorities] = useState<Record<string, "essential" | "important" | "optional">>({});

  const [monthlyCapacityInput, setMonthlyCapacityInput] = useState("");
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
          client.from("myryra_finance_goals").select("id,title,target_cents,saved_cents,priority").eq("user_id", auth.user.id).order("created_at", { ascending: false }).limit(100),
          client.from("myryra_finance_planned_expenses").select("id,title,amount_cents,due_date,paid_at").eq("user_id", auth.user.id).order("due_date", { ascending: true }).limit(200)
        ]);
        if (goalResult.error || expenseResult.error) throw new Error("Falha na consulta");
        if (active) {
          setGoals((goalResult.data ?? []) as Goal[]); setExpenses((expenseResult.data ?? []) as Expense[]);
          setGoalPriorities(Object.fromEntries((goalResult.data ?? []).map(goal => [goal.id, goal.priority ?? "important"])) as Record<string, "essential" | "important" | "optional">);
        }
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
      "Prazo simulado: " + goalHorizonMonths + " meses. Aporte mensal estimado, sem juros: " + money(Math.ceil(remaining / goalHorizonMonths)) + ".",
      "Prioridade definida pelo usuário: " + ({ essential: "essencial", important: "importante", optional: "opcional" }[goal.priority]) + ".",
      "Capacidade mensal informada: " + (parseCents(monthlyCapacityInput, true) === null ? "não informada" : money(parseCents(monthlyCapacityInput, true) ?? 0)) + ".",
      remaining === 0 ? "Esta meta já está coberta pelo valor reservado informado. Não recomende novos aportes para ela sem confirmar um novo objetivo." : "",
      "Pergunte sobre meu prazo, capacidade mensal de poupança, reserva de emergência e prioridades antes de propor um plano.",
      "Trate os valores como informações manuais, não como saldo bancário verificado. Não faça alterações automaticamente nem prometa rentabilidade."
    ].join(" ");
    try {
      sessionStorage.setItem("myryra:myka:investment-handoff", prompt);
      setHandoffError(false);
      navigateTo("vyra-ai");
    } catch { setHandoffError(true); }
  }

  async function setGoalPriority(id: string, priority: "essential" | "important" | "optional") {
    setBusy(true); setError("");
    try {
      const client = createClient();
      const { data: auth, error: authError } = await client.auth.getUser();
      if (authError || !auth.user) throw new Error("Faça login novamente.");
      const { data, error: updateError } = await client.from("myryra_finance_goals")
        .update({ priority }).eq("id", id).eq("user_id", auth.user.id)
        .select("id,priority").single();
      if (updateError || !data) throw new Error(updateError?.message ?? "Não foi possível atualizar a prioridade.");
      setGoals(previous => previous.map(goal => goal.id === id ? { ...goal, priority } : goal));
      setGoalPriorities(previous => ({ ...previous, [id]: priority }));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao salvar a prioridade."); }
    finally { setBusy(false); }
  }

  function askMykaAboutPortfolio() {
    const totalRemaining = goals.reduce((sum, goal) => sum + Math.max(0, goal.target_cents - goal.saved_cents), 0);
    const monthlyNeeded = Math.ceil(totalRemaining / goalHorizonMonths);
    const capacity = parseCents(monthlyCapacityInput, true);
    const prompt = [
      "MIKA, me ajude a priorizar minhas metas financeiras sem comprometer meu orçamento.",
      "Metas: " + goals.map(goal => goal.title + " (restante " + money(Math.max(0, goal.target_cents - goal.saved_cents)) + ", prioridade informada: " + ({essential:"essencial",important:"importante",optional:"opcional"}[goalPriorities[goal.id] ?? "important"]) + ")").join("; ") + ".",
      "Prazo ilustrativo comum: " + goalHorizonMonths + " meses. Total restante: " + money(totalRemaining) + ".",
      "Soma dos aportes mensais estimados: " + money(monthlyNeeded) + ". Capacidade mensal declarada: " + (capacity === null ? "não informada" : money(capacity)) + ".",
      totalRemaining === 0 ? "Todas as metas cadastradas já estão cobertas pelos valores reservados informados. Não sugira aportes adicionais para essas metas; pergunte se deseja definir novos objetivos." : "",
      "Déficit mensal estimado para cumprir todas as metas no prazo: " + (capacity === null ? "não calculado" : money(Math.max(0, monthlyNeeded - capacity))) + ".",
      capacity === 0 && totalRemaining > 0 ? "Neste momento não há capacidade declarada para novos aportes. Priorize revisar despesas e construir um plano realista antes de sugerir investimentos." : "",
      "Cobertura mensal estimada: " + (capacity === null ? "não calculada" : (monthlyNeeded > 0 ? Math.min(100, Math.round(capacity / monthlyNeeded * 100)) : 100) + "%") + ".",
      "Se o aporte mensal disponível não atender todas as metas, explique quais poderão ultrapassar o prazo e sugira alternativas de prazo ou redistribuição, respeitando a prioridade salva.",

      "Respeite as prioridades já definidas pelo usuário; confirme se deseja revisá-las e verifique despesas fixas, dívidas e reserva de emergência.",
      "Sugira uma distribuição viável e ajuste de prazos; não presuma que todos os objetivos devem ser financiados simultaneamente.",
      "Os valores são manuais e a simulação não inclui rendimentos ou inflação. Não execute movimentações."
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
      const { data, error: insertError } = await client.from("myryra_finance_goals").insert({ user_id: auth.user.id, title: goalTitle.trim(), target_cents: cents, priority: newGoalPriority }).select("id,title,target_cents,saved_cents,priority").single();
      if (insertError) throw insertError;
      setGoals(previous => [data as Goal, ...previous]); setGoalPriorities(previous => ({ ...previous, [data.id]: data.priority })); setGoalTitle(""); setGoalAmount(""); setNewGoalPriority("important");
    } catch { setError("Não foi possível salvar a meta."); }
    finally { setBusy(false); }
  }

  async function updateGoalSavings(goal: Goal) {
    const cents = /^0(?:[,.]0{1,2})?$/.test(savedAmountInput.trim()) ? 0 : parseCents(savedAmountInput);
    if (cents === null || cents > goal.target_cents) {
      setError("Informe um valor entre zero e o objetivo da meta.");
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
      {goals.length > 0 && <div className="grid gap-2 sm:grid-cols-2">
        <div className="min-w-0 rounded-xl border border-white/15 bg-slate-950/60 p-3">
          <p className="text-xs text-slate-400">Total das metas</p>
          <p className="break-words text-lg font-semibold text-white">{money(goals.reduce((sum, goal) => sum + goal.target_cents, 0))}</p>
          <p className="mt-1 text-xs text-slate-400">Já reservado: {money(goals.reduce((sum, goal) => sum + Math.min(goal.target_cents, Math.max(0, goal.saved_cents)), 0))}</p>
        </div>
        <div className="min-w-0 rounded-xl border border-violet-400/20 bg-slate-950/60 p-3">
          <p className="text-xs text-slate-400">Ainda necessário</p>
          <p className="break-words text-lg font-semibold text-white">{money(goals.reduce((sum, goal) => sum + Math.max(0, goal.target_cents - goal.saved_cents), 0))}</p>
          <p className="mt-1 text-xs text-slate-400">Aporte médio sem juros: {money(Math.ceil(goals.reduce((sum, goal) => sum + Math.max(0, goal.target_cents - goal.saved_cents), 0) / goalHorizonMonths))}/mês por {goalHorizonMonths} meses</p>
        </div>
      </div>}
      {goals.length > 0 && parseCents(monthlyCapacityInput, true) !== null && (() => {
        const remaining = goals.reduce((sum, goal) => sum + Math.max(0, goal.target_cents - goal.saved_cents), 0);
        const needed = Math.ceil(remaining / goalHorizonMonths);
        const capacity = parseCents(monthlyCapacityInput, true) ?? 0;
        return <p role="status" className="rounded-xl border border-white/15 bg-slate-950/60 p-3 text-sm text-slate-200">
          {needed === 0 ? "Nenhum aporte adicional é necessário para as metas atuais." : capacity >= needed ? "Sua capacidade mensal informada cobre o aporte médio estimado." : "Sua capacidade mensal informada está abaixo do aporte médio estimado."}
          {needed > 0 && <>{" "}Diferença mensal: {money(Math.abs(capacity - needed))}.</>} Valores ilustrativos, sem juros ou movimentações.
          {needed === 0 && <span className="mt-1 block text-slate-300">Todas as metas cadastradas já estão cobertas pelos valores reservados informados.</span>}
          {capacity === 0 && needed > 0 && <span className="mt-1 block text-slate-300">Sem valor disponível para aportes, não é possível estimar um prazo de conclusão. Revise suas despesas e converse com a MIKA para reorganizar o planejamento.</span>}
          {capacity > 0 && capacity < needed && <span className="mt-1 block text-slate-300">Com essa capacidade, o prazo estimado sem juros seria de {Math.ceil(remaining / capacity)} meses. Considere ajustar o prazo ou conversar com a MIKA.</span>}
        </p>;
      })()}
      <form onSubmit={addGoal} className="grid gap-2">
        <input required maxLength={100} aria-label="Nome da meta financeira" placeholder="Ex.: Reserva de emergência" value={goalTitle} onChange={e => setGoalTitle(e.target.value)} className="rounded-xl border border-white/20 bg-slate-950 p-3 text-white" />
        <input required inputMode="decimal" aria-label="Valor da meta em reais" placeholder="Ex.: R$ 10.000,00" value={goalAmount} onChange={e => setGoalAmount(e.target.value)} className="rounded-xl border border-white/20 bg-slate-950 p-3 text-white" />
        <label className="text-xs text-slate-300">Prioridade
          <select value={newGoalPriority} onChange={event => setNewGoalPriority(event.target.value as "essential" | "important" | "optional")} className="mt-1 w-full rounded-xl border border-white/20 bg-slate-950 p-3 text-sm text-white">
            <option value="essential">Essencial</option><option value="important">Importante</option><option value="optional">Opcional</option>
          </select>
        </label>
        <button disabled={busy || loading} className="rounded-xl bg-violet-600 px-4 py-2 font-medium text-white disabled:opacity-50">Criar meta</button>
      </form>
      {goals.length > 0 && <label className="block text-xs text-slate-300">Quanto você consegue reservar por mês? (opcional)
        <input inputMode="decimal" value={monthlyCapacityInput} onChange={event => setMonthlyCapacityInput(event.target.value)} placeholder="Ex.: 350,00" className="mt-1 w-full rounded-lg border border-white/20 bg-slate-950 p-2 text-sm text-white" />
        <span className="mt-1 block text-slate-500">Valor estimado por você. Não cria débito nem altera sua carteira.</span>
      </label>}
      {goals.length > 0 && <label className="block text-xs text-slate-300">Prazo para simular o aporte mensal
        <select value={goalHorizonMonths} onChange={event => setGoalHorizonMonths(Number(event.target.value))} className="mt-1 w-full rounded-lg border border-white/20 bg-slate-950 p-2 text-sm text-white">
          <option value={3}>3 meses</option><option value={6}>6 meses</option><option value={12}>12 meses</option><option value={24}>24 meses</option><option value={36}>36 meses</option>
        </select>
      </label>}
      {goals.length > 1 && <label className="block text-xs text-slate-300">Organizar metas por prioridade de visualização
        <select value={goalSort} onChange={event => setGoalSort(event.target.value as "remaining" | "progress" | "name" | "priority")} className="mt-1 w-full rounded-lg border border-white/20 bg-slate-950 p-2 text-sm text-white">
          <option value="remaining">Menor valor restante primeiro</option>
          <option value="progress">Maior progresso primeiro</option>
          <option value="name">Nome da meta (A–Z)</option>
          <option value="priority">Prioridade definida por você</option>
        </select>
        <span className="mt-1 block text-slate-500">A ordenação muda apenas a visualização; não define qual meta é mais importante para você.</span>
      </label>}
      {goals.length > 1 && parseCents(monthlyCapacityInput, true) !== null && (() => {
        let available = parseCents(monthlyCapacityInput, true) ?? 0;
        const ordered = [...goals].sort((a, b) => ({ essential: 0, important: 1, optional: 2 }[a.priority] - { essential: 0, important: 1, optional: 2 }[b.priority]) || a.title.localeCompare(b.title, "pt-BR"));
        const allocations = ordered.map(goal => {
          const needed = Math.ceil(Math.max(0, goal.target_cents - goal.saved_cents) / goalHorizonMonths);
          const allocated = Math.min(needed, available);
          available -= allocated;
          return { goal, needed, allocated };
        });
        return <div className="rounded-xl border border-violet-400/20 bg-slate-950/60 p-3">
          <p className="text-sm font-semibold text-white">Distribuição sugerida por prioridade</p>
          <p className="mt-1 text-xs text-slate-400">Simulação mensal: primeiro metas essenciais, depois importantes e opcionais. Em caso de empate, ordem alfabética. Os aportes são arredondados para cima por meta e a soma pode diferir alguns centavos do resumo consolidado.</p>
          {(() => {
            const totalNeeded = allocations.reduce((sum, item) => sum + item.needed, 0);
            const totalAllocated = allocations.reduce((sum, item) => sum + item.allocated, 0);
            const coverage = totalNeeded > 0 ? Math.min(100, Math.round(totalAllocated / totalNeeded * 100)) : 100;
            return <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="text-slate-300">Cobertura dos aportes mensais</span>
                <strong className={coverage < 100 ? "text-amber-200" : "text-emerald-200"}>{coverage}%</strong>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-label="Cobertura dos aportes mensais" aria-valuemin={0} aria-valuemax={100} aria-valuenow={coverage}>
                <div className={coverage < 100 ? "h-full rounded-full bg-amber-400" : "h-full rounded-full bg-emerald-400"} style={{ width: `${coverage}%` }} />
              </div>
              <p className="mt-2 text-xs text-slate-400">{money(totalAllocated)} de {money(totalNeeded)} por mês cabem na capacidade declarada.</p>
            </div>;
          })()}
          <details className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3">
            <summary className="cursor-pointer text-xs font-semibold text-violet-200">Ver distribuição e prazos de cada meta ({allocations.length})</summary>
          <ul className="mt-3 space-y-2">{allocations.map(({ goal, needed, allocated }) => <li key={goal.id} className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-200">
            <span>{goal.title} <span className="text-slate-500">({{ essential: "essencial", important: "importante", optional: "opcional" }[goal.priority]})</span></span>
            <span className="text-right font-semibold">{money(allocated)} <span className="font-normal text-slate-500">de {money(needed)}/mês</span><span className="block text-[11px] font-normal text-slate-400">{goal.target_cents <= goal.saved_cents ? "Meta concluída" : allocated === 0 ? "Sem aporte nesta simulação" : `Prazo estimado: ${Math.ceil((goal.target_cents - goal.saved_cents) / allocated)} meses${Math.ceil((goal.target_cents - goal.saved_cents) / allocated) > goalHorizonMonths ? ` · ${Math.ceil((goal.target_cents - goal.saved_cents) / allocated) - goalHorizonMonths} meses além do planejado` : " · dentro do prazo"}`}</span></span>
          </li>)}</ul>
          </details>
          {allocations.some(item => item.allocated < item.needed) && <div className="mt-3 rounded-xl border border-amber-400/25 bg-amber-500/10 p-3">
            <p className="text-xs font-semibold text-amber-100">Seu orçamento não cobre todos os aportes planejados</p>
            <p className="mt-1 text-xs text-amber-100/80">Faltam {money(allocations.reduce((sum, item) => sum + item.needed - item.allocated, 0))} por mês para atender todas as metas no prazo escolhido. Metas de menor prioridade podem receber menos ou nenhum aporte nesta simulação.</p>
            <button type="button" onClick={askMykaAboutPortfolio} className="mt-2 rounded-lg border border-amber-300/50 px-3 py-2 text-xs font-semibold text-amber-100 hover:bg-amber-400/10">Replanejar metas com a MIKA</button>
          </div>}
          <p className="mt-3 text-xs text-slate-400">Capacidade não alocada: {money(available)}. A distribuição não considera rendimentos, inflação, dívidas nem despesas não informadas e não cria lançamentos.</p>
        </div>;
      })()}
      {goals.length > 1 && <div className="rounded-xl border border-violet-400/20 bg-slate-950/60 p-3">
        <p className="text-sm font-semibold text-white">Suas metas em conjunto</p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3"><div className="rounded-lg bg-white/5 p-3"><span className="block text-[11px] text-slate-400">Metas cadastradas</span><strong className="text-lg text-white">{goals.length}</strong></div><div className="rounded-lg bg-white/5 p-3"><span className="block text-[11px] text-slate-400">Metas concluídas</span><strong className="text-lg text-white">{goals.filter(goal => goal.saved_cents >= goal.target_cents).length}</strong></div><div className="col-span-2 rounded-lg bg-white/5 p-3 sm:col-span-1"><span className="block text-[11px] text-slate-400">Aporte mensal necessário</span><strong className="text-lg text-white">{money(goals.reduce((sum, goal) => sum + Math.ceil(Math.max(0, goal.target_cents - goal.saved_cents) / goalHorizonMonths), 0))}</strong><span className="block text-[11px] text-slate-500">Prazo de {goalHorizonMonths} meses</span></div></div>
        {parseCents(monthlyCapacityInput, true) !== null && <p className="mt-1 text-xs text-amber-200">{goals.reduce((sum, goal) => sum + Math.ceil(Math.max(0, goal.target_cents - goal.saved_cents) / goalHorizonMonths), 0) > (parseCents(monthlyCapacityInput, true) ?? 0) ? "A soma dos aportes ultrapassa sua capacidade mensal informada. Considere priorizar metas ou ampliar prazos." : "A soma dos aportes cabe na capacidade mensal informada, antes de considerar despesas e imprevistos."}</p>}
        <button type="button" onClick={askMykaAboutPortfolio} className="mt-3 rounded-lg border border-violet-400 px-3 py-2 text-xs font-semibold text-violet-200">Priorizar metas com a MIKA</button>
        <p className="mt-2 text-xs text-slate-500">A MIKA considerará as prioridades salvas e poderá sugerir ajustes, sem alterá-las automaticamente.</p>
      </div>}
      <ul className="space-y-3">{[...goals].sort((a, b) => goalSort === "priority" ? ({essential:0,important:1,optional:2}[goalPriorities[a.id] ?? "important"] - {essential:0,important:1,optional:2}[goalPriorities[b.id] ?? "important"]) : goalSort === "name" ? a.title.localeCompare(b.title, "pt-BR") : goalSort === "progress" ? (b.saved_cents / Math.max(1,b.target_cents)) - (a.saved_cents / Math.max(1,a.target_cents)) : Math.max(0,a.target_cents-a.saved_cents) - Math.max(0,b.target_cents-b.saved_cents)).map(goal => <li key={goal.id} className="rounded-xl border border-white/10 p-3">
        <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-medium text-white">{goal.title}</p><p className="mt-1 text-xs text-slate-400">{money(goal.saved_cents)} reservados de {money(goal.target_cents)}</p></div><button type="button" disabled={busy} onClick={() => void remove("myryra_finance_goals", goal.id)} className="text-xs text-violet-300 disabled:opacity-50">Excluir</button></div>
        <div role="progressbar" aria-label={`Progresso da meta ${goal.title}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.round(goal.saved_cents / Math.max(1, goal.target_cents) * 100))} className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-violet-500" style={{ width: `${Math.min(100, goal.saved_cents / Math.max(1, goal.target_cents) * 100)}%` }} /></div>
        <label className="mt-3 block text-xs text-slate-300">Prioridade desta meta
          <select value={goalPriorities[goal.id] ?? "important"} disabled={busy} onChange={event => void setGoalPriority(goal.id, event.target.value as "essential" | "important" | "optional")} className="mt-1 w-full rounded-lg border border-white/20 bg-slate-950 p-2 text-sm text-white">
            <option value="essential">Essencial</option><option value="important">Importante</option><option value="optional">Opcional</option>
          </select>
        </label>
        <div className="mt-3 rounded-lg bg-slate-950/60 p-3">
          <p className="text-xs text-slate-400">Faltam <strong className="text-white">{money(Math.max(0, goal.target_cents - goal.saved_cents))}</strong> para alcançar esta meta.</p>
          <p className="mt-1 text-xs text-slate-300">Para chegar lá em {goalHorizonMonths} meses, reserve aproximadamente <strong className="text-emerald-300">{money(Math.ceil(Math.max(0, goal.target_cents - goal.saved_cents) / goalHorizonMonths))} por mês</strong>.</p>
          {parseCents(monthlyCapacityInput, true) !== null && Math.max(0, goal.target_cents - goal.saved_cents) > 0 && (parseCents(monthlyCapacityInput, true) ?? 0) > 0 && (parseCents(monthlyCapacityInput, true) ?? 0) < Math.ceil(Math.max(0, goal.target_cents - goal.saved_cents) / goalHorizonMonths) && <p className="mt-2 text-xs text-amber-200">
            Mantendo essa capacidade mensal, você precisaria de aproximadamente {Math.ceil(Math.max(0, goal.target_cents - goal.saved_cents) / (parseCents(monthlyCapacityInput, true) ?? 1))} meses para atingir a meta, sem considerar rendimentos ou inflação.
          </p>}
          {parseCents(monthlyCapacityInput, true) !== null && <p className="mt-2 text-xs text-slate-300">
            {Math.max(0, goal.target_cents - goal.saved_cents) === 0 ? "Meta atingida." : (parseCents(monthlyCapacityInput, true) ?? 0) >= Math.ceil(Math.max(0, goal.target_cents - goal.saved_cents) / goalHorizonMonths) ? "Sua capacidade mensal informada cobre o aporte estimado." : "Sua capacidade mensal informada é inferior ao aporte estimado. A MIKA pode ajudar a rever prazo e prioridades."}
          </p>}
          <p className="mt-1 text-xs text-slate-500">Cálculo simples, sem juros, inflação ou rendimentos. Não representa transferência automática.</p>
        </div>
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
