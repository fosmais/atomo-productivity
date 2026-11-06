"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useVyraNavigation } from "./vyra-module-context";

function parseBRL(input: string): number | null {
  let value = input.trim().replace(/R\$/gi, "").replace(/\s/g, "");
  if (value.includes(",") && value.includes(".")) {
    value = value.lastIndexOf(",") > value.lastIndexOf(".") ? value.replace(/\./g, "").replace(",", ".") : value.replace(/,/g, "");
  } else if (value.includes(",")) value = value.replace(",", ".");
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(value)) value = value.replace(/\./g, "");
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(value)) return null;
  const cents = Math.round(Number(value) * 100);
  return Number.isSafeInteger(cents) && Math.abs(cents) <= 100000000000 ? cents : null;
}

type Entry = { id: string; description: string; amount_cents: number; kind: "income" | "expense"; created_at: string };

export default function MyryraFinanceStarter() {
  const { navigateTo } = useVyraNavigation();
  const [handoffError, setHandoffError] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [openingBalanceCents, setOpeningBalanceCents] = useState(0);
  const [openingBalanceInput, setOpeningBalanceInput] = useState("");
  const [balanceSaving, setBalanceSaving] = useState(false);
  const [balanceSaved, setBalanceSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [balanceError, setBalanceError] = useState("");
  const [entryError, setEntryError] = useState("");
  const [refreshAttempt, setRefreshAttempt] = useState(0);
  useEffect(() => {
    let mounted = true;
    let latestRequest = 0;
    const load = async () => {
      const requestId = ++latestRequest;
      setLoading(true);
      try {
        const client = createClient();
        const { data: auth, error: authError } = await client.auth.getUser();
        if (authError || !auth.user) throw new Error("Faça login para acessar sua carteira.");
        const allEntries: Entry[] = [];
        const pageSize = 500;
        for (let offset = 0; ; offset += pageSize) {
          const { data: page, error: queryError } = await client.from("myryra_finance_entries")
            .select("id,description,amount_cents,kind,created_at")
            .eq("user_id", auth.user.id).order("created_at", { ascending: false })
            .order("id", { ascending: false }).range(offset, offset + pageSize - 1);
          if (queryError) throw queryError;
          allEntries.push(...((page ?? []) as Entry[]));
          if (!page || page.length < pageSize) break;
        }
        const { data: balance, error: balanceError } = await client.from("myryra_finance_balances")
          .select("opening_balance_cents").eq("user_id", auth.user.id).maybeSingle();
        if (balanceError) throw balanceError;
        if (mounted && requestId === latestRequest) {
          setEntries(allEntries);
          const nextBalance = Number(balance?.opening_balance_cents ?? 0);
          setOpeningBalanceCents(nextBalance);
          setOpeningBalanceInput((nextBalance / 100).toFixed(2).replace(".", ","));
          setError("");
        }
      } catch {
        if (mounted && requestId === latestRequest) setError("Não foi possível atualizar os dados financeiros. Os valores exibidos podem estar desatualizados; tente novamente.");
      } finally { if (mounted && requestId === latestRequest) setLoading(false); }
    };
    void load();
    const refresh = () => void load();
    window.addEventListener("myryra:finance-updated", refresh);
    return () => { mounted = false; window.removeEventListener("myryra:finance-updated", refresh); };
  }, [refreshAttempt]);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [kind, setKind] = useState<"income" | "expense">("expense");
  const totals = useMemo(() => openingBalanceCents + entries.reduce((sum, item) => sum + (item.kind === "income" ? item.amount_cents : -item.amount_cents), 0), [entries, openingBalanceCents]);
  const currency = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  const askMykaToReplan = () => {
    const prompt = [
      "MIKA, meu saldo financeiro estimado ficou negativo. Ajude-me a reorganizar meu orçamento com orientações educativas.",
      "Saldo estimado informado na MYRYRA: " + currency(totals / 100) + ".",
      "Considere que os valores são lançamentos manuais, não um saldo bancário verificado.",
      "Faça uma pergunta por vez para identificar gastos essenciais, despesas adiáveis e prioridades.",
      "Sugira um plano realista sem alterar registros automaticamente e sem recomendar crédito ou investimentos específicos."
    ].join(" ");
    try {
      sessionStorage.setItem("myryra:myka:investment-handoff", prompt);
      setHandoffError(false);
      navigateTo("vyra-ai");
    } catch { setHandoffError(true); }
  };
  const addEntry = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving || balanceSaving || loading) return;
    const cents = parseBRL(amount);
    if (cents === null || cents <= 0 || !name.trim() || name.trim().length > 100) {
      setEntryError("Informe uma descrição e um valor positivo com até duas casas decimais. Ex.: 3.999,00.");
      return;
    }
    setSaving(true); setEntryError("");
    try {
      const client = createClient();
      const { data: auth, error: authError } = await client.auth.getUser();
      if (authError || !auth.user) throw new Error("Sessão expirada.");
      const { data, error: insertError } = await client.from("myryra_finance_entries")
        .insert({ user_id: auth.user.id, description: name.trim(), amount_cents: cents, kind })
        .select("id,description,amount_cents,kind,created_at").single();
      if (insertError) throw insertError;
      if (!data) throw new Error("Lançamento não confirmado pelo banco de dados.");
      setEntries(previous => [data as Entry, ...previous]);
      setName(""); setAmount("");
      window.dispatchEvent(new Event("myryra:finance-updated"));
    } catch (cause) { setEntryError(cause instanceof Error ? `Não foi possível salvar o lançamento: ${cause.message}` : "Não foi possível salvar o lançamento. Tente novamente."); }
    finally { setSaving(false); }
  };

  const saveOpeningBalance = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving || balanceSaving || loading) return;
    const cents = parseBRL(openingBalanceInput);
    if (cents === null) {
      setBalanceError("Informe um saldo inicial válido. Ex.: 39.999,00.");
      return;
    }
    setBalanceSaving(true); setBalanceError(""); setBalanceSaved(false);
    try {
      const client = createClient();
      const { data: auth, error: authError } = await client.auth.getUser();
      if (authError || !auth.user) throw new Error("Sessão expirada.");
      const { data: savedBalance, error: balanceError } = await client.from("myryra_finance_balances").upsert({
        user_id: auth.user.id, opening_balance_cents: cents, updated_at: new Date().toISOString()
      }, { onConflict: "user_id" }).select("opening_balance_cents").single();
      if (balanceError) throw balanceError;
      if (!savedBalance || Number(savedBalance.opening_balance_cents) !== cents) throw new Error("Saldo não confirmado pelo banco de dados.");
      setOpeningBalanceCents(cents);
      setBalanceSaved(true);
      window.dispatchEvent(new Event("myryra:finance-updated"));
    } catch (cause) { setBalanceError(cause instanceof Error ? `Não foi possível salvar o saldo inicial: ${cause.message}` : "Não foi possível salvar o saldo inicial."); }
    finally { setBalanceSaving(false); }
  };

  const deleteEntry = async (id: string) => {
    if (saving || balanceSaving || loading) return;
    setSaving(true);
    setError("");
    try {
      const client = createClient();
      const { data: auth, error: authError } = await client.auth.getUser();
      if (authError || !auth.user) throw new Error("Sessão expirada.");
      const { data: deleted, error: deleteError } = await client.from("myryra_finance_entries").delete().eq("id", id).eq("user_id", auth.user.id).select("id");
      if (deleteError) throw deleteError;
      if (!deleted?.length) throw new Error("Registro não encontrado.");
      setEntries(previous => previous.filter(item => item.id !== id));
      window.dispatchEvent(new Event("myryra:finance-updated"));
    } catch { setError("Não foi possível excluir o lançamento."); }
    finally { setSaving(false); }
  };

  return (
    <div className="min-w-0 space-y-4">
      <div className="rounded-xl border border-amber-400/30 bg-amber-400/5 p-3 text-sm text-amber-100">
        Planejamento financeiro manual: o saldo estimado depende dos valores que você informa. Não há conexão bancária, atualização em tempo real ou movimentação de dinheiro.
      </div>
      {!loading && !error && totals < 0 && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-400/40 bg-rose-500/10 p-4">
          <div className="min-w-0"><p className="font-semibold text-rose-100">Seu saldo estimado está negativo</p><p className="mt-1 text-sm text-rose-100/85">Converse com a MIKA para rever gastos e construir um plano de recuperação. Os valores são informados manualmente.</p></div>
          <button type="button" onClick={askMykaToReplan} className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 focus-visible:outline-2 focus-visible:outline-violet-300">Replanejar com a MIKA</button>
        </div>
      )}
      {handoffError && <p role="alert" className="text-sm text-rose-300">Não foi possível abrir a MIKA. Verifique as permissões do navegador.</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/15 bg-slate-900/75 p-5">
          <p className="text-sm text-slate-300">Saldo estimado</p>
          <p className="mt-2 text-2xl font-semibold text-white">{currency(totals / 100)}</p>
          {entries.length > 200 && <p className="mt-2 text-xs text-slate-400">Saldo calculado com todo o histórico; exibindo os 200 lançamentos mais recentes abaixo.</p>}
        </div>
        <div className="rounded-2xl border border-white/15 bg-slate-900/75 p-5">
          <p className="text-sm text-slate-300">Lançamentos no histórico</p>
          <p className="mt-2 text-2xl font-semibold text-white">{entries.length}</p>
        </div>
      </div>
      <form onSubmit={saveOpeningBalance} className="rounded-2xl border border-violet-400/30 bg-slate-900/75 p-4 sm:p-5">
        <h3 className="font-semibold text-white">Saldo inicial informado</h3>
        <p className="mt-1 text-sm text-slate-400">Quanto você possui hoje? Informe seu saldo manualmente para iniciar o planejamento. Alterar esse valor recalcula a posição estimada.</p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="min-w-0 flex-1 text-sm text-slate-300">Saldo inicial (R$)
            <input required inputMode="decimal" value={openingBalanceInput} onChange={event => { setOpeningBalanceInput(event.target.value); setBalanceSaved(false); }} placeholder="Ex.: 2500,00" className="mt-1 w-full rounded-lg border border-white/20 bg-slate-950 p-3 text-white" />
          </label>
          <button type="submit" disabled={saving || balanceSaving || loading} className="rounded-xl bg-violet-600 px-4 py-3 font-medium text-white disabled:opacity-50 hover:bg-violet-500">{balanceSaving ? "Salvando..." : "Salvar saldo inicial"}</button>
        </div>
        {balanceError && <p role="alert" className="mt-2 text-sm text-rose-300">{balanceError}</p>}
        {balanceSaved && <p role="status" className="mt-2 text-sm text-emerald-300">Saldo inicial salvo e confirmado.</p>}
      </form>
      <form onSubmit={addEntry} className="space-y-3 rounded-2xl border border-white/15 bg-slate-900/75 p-4 sm:p-5">
        <h3 className="font-semibold text-white">Novo lançamento manual</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm text-slate-300">Descrição
            <input required maxLength={100} value={name} onChange={event => setName(event.target.value)} placeholder="Ex.: Mercado" className="mt-1 w-full rounded-lg border border-white/20 bg-slate-950 p-3 text-white" />
          </label>
          <label className="text-sm text-slate-300">Valor (R$)
            <input required inputMode="decimal" value={amount} onChange={event => setAmount(event.target.value)} placeholder="0,00" className="mt-1 w-full rounded-lg border border-white/20 bg-slate-950 p-3 text-white" />
          </label>
          <label className="text-sm text-slate-300">Tipo
            <select value={kind} onChange={event => setKind(event.target.value as "income" | "expense")} className="mt-1 w-full rounded-lg border border-white/20 bg-slate-950 p-3 text-white">
              <option value="expense">Despesa</option><option value="income">Receita</option>
            </select>
          </label>
        </div>
        <button type="submit" disabled={saving || balanceSaving || loading} className="rounded-xl bg-violet-600 px-4 py-2 font-medium text-white hover:bg-violet-500">{saving ? "Salvando..." : "Adicionar lançamento"}</button>
        {entryError && <p role="alert" className="text-sm text-rose-300">{entryError}</p>}
      </form>
      <div className="rounded-2xl border border-white/15 bg-slate-900/75 p-4 sm:p-5">
        <h3 className="mb-3 font-semibold text-white">Seus lançamentos</h3>
        {entries.length === 0 ? <p className="text-sm text-slate-400">{loading ? "Carregando lançamentos..." : "Nenhum lançamento cadastrado."}</p> : <ul className="space-y-2">{entries.slice(0, 200).map(item => <li key={item.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-b border-white/10 py-2 text-sm"><span className="min-w-0 flex-1 break-words text-slate-200">{item.description}</span><span className={item.kind === "income" ? "shrink-0 text-emerald-300" : "shrink-0 text-rose-300"}>{item.kind === "income" ? "+" : "−"} {currency(item.amount_cents / 100)}</span><button type="button" disabled={saving || balanceSaving || loading} onClick={() => void deleteEntry(item.id)} className="text-slate-400 underline hover:text-white disabled:cursor-not-allowed disabled:opacity-50">Excluir</button></li>)}</ul>}
      </div>
      {error && <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-rose-300"><span>{error}</span><button type="button" onClick={() => { setLoading(true); setRefreshAttempt(previous => previous + 1); }} className="rounded-lg border border-rose-300/40 px-3 py-2 font-medium hover:bg-rose-300/10">Tentar novamente</button></div>}
      <p className="text-xs text-slate-400">Os valores são estimativas baseadas nos dados informados por você. A MYRYRA não consulta saldos bancários nem movimenta seu dinheiro.</p>
    </div>
  );
}
