"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
const trashEnabled = process.env.NEXT_PUBLIC_MYRYRA_FINANCE_TRASH_ENABLED === "true";

function calculateBalanceCents(openingBalanceCents: number, entries: Entry[]): number | null {
  if (!Number.isSafeInteger(openingBalanceCents)) return null;
  let total = openingBalanceCents;
  for (const entry of entries) {
    if (!Number.isSafeInteger(entry.amount_cents) || entry.amount_cents <= 0 || (entry.kind !== "income" && entry.kind !== "expense")) return null;
    total += entry.kind === "income" ? entry.amount_cents : -entry.amount_cents;
    if (!Number.isSafeInteger(total)) return null;
  }
  return total;
}

export default function MyryraFinanceStarter() {
  const { navigateTo } = useVyraNavigation();
  const [handoffError, setHandoffError] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [trashedEntries, setTrashedEntries] = useState<Entry[]>([]);
  const [showTrash, setShowTrash] = useState(false);
  const [openingBalanceCents, setOpeningBalanceCents] = useState(0);
  const [openingBalanceInput, setOpeningBalanceInput] = useState("");
  const openingBalanceDraftDirty = useRef(false);
  const [balanceSaving, setBalanceSaving] = useState(false);
  const [balanceSaved, setBalanceSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [balanceError, setBalanceError] = useState("");
  const [entryError, setEntryError] = useState("");
  const [entrySuccess, setEntrySuccess] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleteSuccess, setDeleteSuccess] = useState("");
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
        const seenEntryIds = new Set<string>();
        const pageSize = 500;
        for (let offset = 0; ; offset += pageSize) {
          let query = client.from("myryra_finance_entries")
            .select("id,description,amount_cents,kind,created_at")
            .eq("user_id", auth.user.id);
          if (trashEnabled) query = query.is("deleted_at", null);
          const { data: page, error: queryError } = await query.order("created_at", { ascending: false })
            .order("id", { ascending: false }).range(offset, offset + pageSize - 1);
          if (queryError) throw queryError;
          if ((page ?? []).some(item => !Number.isSafeInteger(item.amount_cents) || item.amount_cents <= 0 || !["income", "expense"].includes(item.kind))) throw new Error("Histórico financeiro inválido.");
          // Stop an obsolete pagination loop when a newer refresh takes precedence.
          if (!mounted || requestId !== latestRequest) return;
          for (const item of page ?? []) {
            if (!item.id || seenEntryIds.has(item.id)) throw new Error("Histórico financeiro duplicado ou inválido.");
            seenEntryIds.add(item.id);
            allEntries.push(item as Entry);
          }
          if (!page || page.length < pageSize) break;
        }
        if (trashEnabled) {
          const { data: trashed, error: trashError } = await client.from("myryra_finance_entries")
            .select("id,description,amount_cents,kind,created_at")
            .eq("user_id", auth.user.id).not("deleted_at", "is", null)
            .order("created_at", { ascending: false }).limit(100);
          if (trashError) throw trashError;
          if (mounted && requestId === latestRequest) setTrashedEntries((trashed ?? []) as Entry[]);
        }
        const { data: balance, error: balanceError } = await client.from("myryra_finance_balances")
          .select("opening_balance_cents").eq("user_id", auth.user.id).maybeSingle();
        if (balanceError) throw balanceError;
        if (mounted && requestId === latestRequest) {
          const nextBalance = Number(balance?.opening_balance_cents ?? 0);
          if (!Number.isSafeInteger(nextBalance)) throw new Error("Saldo inicial inválido.");
          if (calculateBalanceCents(nextBalance, allEntries) === null) throw new Error("Total financeiro fora do limite seguro.");
          setEntries(allEntries);
          setOpeningBalanceCents(nextBalance);
          if (!openingBalanceDraftDirty.current) setOpeningBalanceInput((nextBalance / 100).toFixed(2).replace(".", ","));
          setError("");
          setDeleteError("");
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
  const totals = useMemo(() => calculateBalanceCents(openingBalanceCents, entries) ?? 0, [entries, openingBalanceCents]);
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
  const startEditing = (item: Entry) => {
    setEditingId(item.id);
    setName(item.description);
    setAmount((item.amount_cents / 100).toFixed(2).replace(".", ","));
    setKind(item.kind);
    setEntryError(""); setEntrySuccess("");
  };
  const cancelEditing = () => {
    setEditingId(null); setName(""); setAmount(""); setKind("expense");
    setEntryError("");
  };
  const saveEditing = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingId || saving || balanceSaving || loading || error) return;
    const cents = parseBRL(amount);
    const previous = entries.find(item => item.id === editingId);
    if (!previous || cents === null || cents <= 0 || !name.trim() || name.trim().length > 100 ||
      calculateBalanceCents(openingBalanceCents, entries.map(item => item.id === editingId ? { ...item, description: name.trim(), amount_cents: cents, kind } : item)) === null) {
      setEntryError("Confira a descrição, o valor e o saldo total antes de salvar."); return;
    }
    setSaving(true); setEntryError(""); setEntrySuccess("");
    try {
      const client = createClient();
      const { data: auth, error: authError } = await client.auth.getUser();
      if (authError || !auth.user) throw new Error("Sessão expirada.");
      const { data, error: updateError } = await client.from("myryra_finance_entries")
        .update({ description: name.trim(), amount_cents: cents, kind })
        .eq("id", editingId).eq("user_id", auth.user.id)
        .select("id,description,amount_cents,kind,created_at").single();
      if (updateError || !data || data.id !== editingId || data.amount_cents !== cents || data.kind !== kind || data.description !== name.trim()) throw new Error("Atualização não confirmada.");
      setEntries(current => current.map(item => item.id === editingId ? data as Entry : item));
      cancelEditing();
      setEntrySuccess("Lançamento atualizado com sucesso.");
      window.dispatchEvent(new Event("myryra:finance-updated"));
    } catch { setEntryError("Não foi possível editar o lançamento. Confira as permissões e tente novamente."); }
    finally { setSaving(false); }
  };
  const addEntry = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving || balanceSaving || loading || error) return;
    const cents = parseBRL(amount);
    if (cents === null || cents <= 0 || !name.trim() || name.trim().length > 100 || calculateBalanceCents(openingBalanceCents, [...entries, { id: "pending", description: name.trim(), amount_cents: cents, kind, created_at: "" }]) === null) {
      setEntryError("Informe o que foi e um valor maior que zero. Exemplo: 39,90. Confira também se o total está dentro do limite permitido.");
      return;
    }
    setSaving(true); setEntryError(""); setEntrySuccess("");
    try {
      const client = createClient();
      const { data: auth, error: authError } = await client.auth.getUser();
      if (authError || !auth.user) throw new Error("Sessão expirada.");
      const { data, error: insertError } = await client.from("myryra_finance_entries")
        .insert({ user_id: auth.user.id, description: name.trim(), amount_cents: cents, kind })
        .select("id,description,amount_cents,kind,created_at").single();
      if (insertError) throw insertError;
      if (!data || data.amount_cents !== cents || data.kind !== kind || data.description !== name.trim() || !data.id || !data.created_at) throw new Error("Lançamento retornado pelo banco de dados não corresponde ao solicitado.");
      if (calculateBalanceCents(openingBalanceCents, [data as Entry, ...entries]) === null) throw new Error("Lançamento confirmado, mas o saldo precisa ser atualizado.");
      setEntries(previous => [data as Entry, ...previous]);
      setName(""); setAmount("");
      setEntrySuccess(`${kind === "income" ? "Entrada" : "Gasto"} de ${currency(cents / 100)} salvo com sucesso.`);
      window.dispatchEvent(new Event("myryra:finance-updated"));
    } catch (cause) { setEntryError(cause instanceof Error ? `Não foi possível salvar o lançamento: ${cause.message}` : "Não foi possível salvar o lançamento. Tente novamente."); }
    finally { setSaving(false); }
  };

  const saveOpeningBalance = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving || balanceSaving || loading || error) return;
    const cents = parseBRL(openingBalanceInput);
    if (cents === null || calculateBalanceCents(cents, entries) === null) {
      setBalanceError("Informe um saldo inicial válido que mantenha o total financeiro dentro do limite seguro. Ex.: 39.999,00.");
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
      openingBalanceDraftDirty.current = false;
      setBalanceSaved(true);
      window.dispatchEvent(new Event("myryra:finance-updated"));
    } catch (cause) { setBalanceError(cause instanceof Error ? `Não foi possível salvar o saldo inicial: ${cause.message}` : "Não foi possível salvar o saldo inicial."); }
    finally { setBalanceSaving(false); }
  };

  const deleteEntry = async (id: string) => {
    if (saving || balanceSaving || loading || error) return;
    const target = entries.find(item => item.id === id);
    if (!target || !window.confirm(`Excluir "${target.description}" (${currency(target.amount_cents / 100)})? ${trashEnabled ? "Você poderá restaurá-lo na lixeira." : "A exclusão é definitiva e não pode ser desfeita."}`)) return;
    setSaving(true);
    setDeleteError("");
    setDeleteSuccess("");
    try {
      const client = createClient();
      const { data: auth, error: authError } = await client.auth.getUser();
      if (authError || !auth.user) throw new Error("Sessão expirada.");
      const baseQuery = client.from("myryra_finance_entries");
      const { data: deleted, error: deleteError } = trashEnabled
        ? await baseQuery.update({ deleted_at: new Date().toISOString() }).eq("id", id).eq("user_id", auth.user.id).is("deleted_at", null).select("id")
        : await baseQuery.delete().eq("id", id).eq("user_id", auth.user.id).select("id");
      if (deleteError) throw deleteError;
      if (!deleted || deleted.length !== 1 || deleted[0]?.id !== id) throw new Error("Exclusão não confirmada para o lançamento solicitado.");
      setEntries(previous => previous.filter(item => item.id !== id));
      setDeleteSuccess(`"${target.description}" foi ${trashEnabled ? "movido para a lixeira" : "excluído"}. O saldo será atualizado.`);
      window.dispatchEvent(new Event("myryra:finance-updated"));
    } catch {
      setDeleteError("Não foi possível confirmar a exclusão. Confira o histórico atualizado antes de tentar novamente.");
      window.dispatchEvent(new Event("myryra:finance-updated"));
    }
    finally { setSaving(false); }
  };

  const restoreEntry = async (id: string) => {
    if (!trashEnabled || saving || balanceSaving || loading || error) return;
    const target = trashedEntries.find(item => item.id === id);
    if (!target) return;
    if (calculateBalanceCents(openingBalanceCents, [...entries, target]) === null) {
      setDeleteError("Não é possível restaurar: o saldo ultrapassaria o limite seguro.");
      return;
    }
    setSaving(true); setDeleteError(""); setDeleteSuccess("");
    try {
      const client = createClient();
      const { data: auth, error: authError } = await client.auth.getUser();
      if (authError || !auth.user) throw new Error("Sessão expirada.");
      const { data, error: restoreError } = await client.from("myryra_finance_entries")
        .update({ deleted_at: null }).eq("id", id).eq("user_id", auth.user.id)
        .not("deleted_at", "is", null).select("id");
      if (restoreError || !data || data.length !== 1 || data[0]?.id !== id) throw new Error("Restauração não confirmada.");
      setDeleteSuccess(`"${target.description}" restaurado com sucesso.`);
      window.dispatchEvent(new Event("myryra:finance-updated"));
    } catch {
      setDeleteError("Não foi possível confirmar a restauração. Confira o histórico atualizado.");
      window.dispatchEvent(new Event("myryra:finance-updated"));
    } finally { setSaving(false); }
  };

  return (
    <div className="min-w-0 space-y-4">
      <div className="rounded-xl border border-amber-400/30 bg-amber-400/5 p-3 text-sm text-amber-100">
        Planejamento financeiro manual: o saldo estimado depende dos valores que você informa. Não há conexão bancária, atualização em tempo real ou movimentação de dinheiro.
      </div>
      {loading && <p role="status" aria-live="polite" className="rounded-xl border border-white/15 bg-slate-900/60 p-3 text-sm text-slate-200">Atualizando histórico e saldo estimado. Os valores exibidos podem ser da consulta anterior.</p>}
      {!loading && error && <p role="alert" className="rounded-xl border border-rose-400/40 bg-rose-500/10 p-3 text-sm text-rose-100">Atenção: não foi possível confirmar o saldo atual. Os valores abaixo podem estar desatualizados. Use “Tentar novamente” antes de tomar decisões financeiras.</p>}
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
          <p className="text-sm text-slate-300">Entradas e gastos registrados</p>
          <p className="mt-2 text-2xl font-semibold text-white">{entries.length}</p>
        </div>
      </div>
      <form onSubmit={saveOpeningBalance} className="rounded-2xl border border-violet-400/30 bg-slate-900/75 p-4 sm:p-5">
        <h3 className="font-semibold text-white">Seu saldo de partida</h3>
        <p className="mt-1 text-sm text-slate-400">Informe o saldo de partida, antes dos lançamentos registrados nesta carteira. Receitas e despesas cadastradas são somadas a esse valor. Não informe o saldo atual se ele já inclui essas movimentações, para evitar contagem duplicada.</p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="min-w-0 flex-1 text-sm text-slate-300">Saldo inicial (R$)
            <input required inputMode="decimal" value={openingBalanceInput} onChange={event => { openingBalanceDraftDirty.current = true; setOpeningBalanceInput(event.target.value); setBalanceSaved(false); }} placeholder="Ex.: 2500,00" className="mt-1 w-full rounded-lg border border-white/20 bg-slate-950 p-3 text-white" />
          </label>
          <button type="submit" disabled={saving || balanceSaving || loading || Boolean(error)} className="rounded-xl bg-violet-600 px-4 py-3 font-medium text-white disabled:opacity-50 hover:bg-violet-500">{balanceSaving ? "Salvando..." : "Salvar saldo"}</button>
        </div>
        {balanceError && <p role="alert" className="mt-2 text-sm text-rose-300">{balanceError}</p>}
        {balanceSaved && <p role="status" className="mt-2 text-sm text-emerald-300">Saldo salvo com sucesso.</p>}
      </form>
      <form onSubmit={editingId ? saveEditing : addEntry} className="space-y-3 rounded-2xl border border-white/15 bg-slate-900/75 p-4 sm:p-5">
        <h3 className="font-semibold text-white">{editingId ? "Editar entrada ou gasto" : "Adicionar entrada ou gasto"}</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm text-slate-300">O que foi?
            <input required maxLength={100} value={name} onChange={event => { setName(event.target.value); setEntrySuccess(""); }} placeholder="Ex.: Mercado" className="mt-1 w-full rounded-lg border border-white/20 bg-slate-950 p-3 text-white" />
          </label>
          <label className="text-sm text-slate-300">Valor (R$)
            <input required inputMode="decimal" value={amount} onChange={event => { setAmount(event.target.value); setEntrySuccess(""); }} placeholder="0,00" className="mt-1 w-full rounded-lg border border-white/20 bg-slate-950 p-3 text-white" />
          </label>
          <label className="text-sm text-slate-300">Entrada ou gasto?
            <select value={kind} onChange={event => { setKind(event.target.value as "income" | "expense"); setEntrySuccess(""); }} className="mt-1 w-full rounded-lg border border-white/20 bg-slate-950 p-3 text-white">
              <option value="expense">Gasto (saída)</option><option value="income">Entrada (recebimento)</option>
            </select>
          </label>
        </div>
        <button type="submit" disabled={saving || balanceSaving || loading || Boolean(error)} className="rounded-xl bg-violet-600 px-4 py-2 font-medium text-white hover:bg-violet-500">{saving ? "Salvando..." : editingId ? "Salvar alterações" : "Salvar valor"}</button>
        {editingId && <button type="button" disabled={saving} onClick={cancelEditing} className="ml-3 rounded-xl border border-white/20 px-4 py-2 text-sm text-slate-200">Cancelar edição</button>}
        {entryError && <p role="alert" className="text-sm text-rose-300">{entryError}</p>}
        {entrySuccess && <p role="status" aria-live="polite" className="text-sm text-emerald-300">{entrySuccess}</p>}
      </form>
      <div className="rounded-2xl border border-white/15 bg-slate-900/75 p-4 sm:p-5">
        <h3 className="mb-3 font-semibold text-white">Histórico de entradas e gastos</h3>
        {entries.length === 0 ? <p className="text-sm text-slate-400">{loading ? "Carregando lançamentos..." : "Você ainda não adicionou entradas ou gastos."}</p> : <ul className="space-y-2">{entries.slice(0, 200).map(item => <li key={item.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-b border-white/10 py-2 text-sm"><span className="min-w-0 flex-1 break-words text-slate-200">{item.description}</span><span className={item.kind === "income" ? "shrink-0 text-emerald-300" : "shrink-0 text-rose-300"}>{item.kind === "income" ? "+" : "−"} {currency(item.amount_cents / 100)}</span><button type="button" disabled={saving || balanceSaving || loading || Boolean(error)} onClick={() => startEditing(item)} className="text-violet-300 underline hover:text-white disabled:opacity-50">Editar</button><button type="button" disabled={saving || balanceSaving || loading || Boolean(error) || editingId === item.id} onClick={() => void deleteEntry(item.id)} className="text-slate-400 underline hover:text-white disabled:cursor-not-allowed disabled:opacity-50">Excluir</button></li>)}</ul>}
      </div>
      {trashEnabled && (
        <section className="rounded-2xl border border-white/15 bg-slate-900/75 p-4 sm:p-5">
          <button type="button" aria-expanded={showTrash} onClick={() => setShowTrash(value => !value)}
            className="font-semibold text-white underline underline-offset-4">
            Lixeira financeira ({trashedEntries.length}{trashedEntries.length === 100 ? "+" : ""}) — {showTrash ? "ocultar" : "mostrar"}
          </button>
          {showTrash && (trashedEntries.length === 0
            ? <p className="mt-3 text-sm text-slate-400">Nenhum lançamento na lixeira.</p>
            : <ul className="mt-3 space-y-2">{trashedEntries.map(item => (
                <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 py-2 text-sm">
                  <span className="min-w-0 flex-1 break-words text-slate-200">{item.description} — {currency(item.amount_cents / 100)}</span>
                  <button type="button" disabled={saving || balanceSaving || loading || Boolean(error)}
                    onClick={() => void restoreEntry(item.id)} className="text-violet-200 underline disabled:opacity-50">Restaurar</button>
                </li>
              ))}</ul>)}
        </section>
      )}
      {deleteError && <p role="alert" className="text-sm text-rose-300">{deleteError}</p>}
      {deleteSuccess && <p role="status" aria-live="polite" className="text-sm text-emerald-300">{deleteSuccess}</p>}
      {error && <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-rose-300"><span>{error}</span><button type="button" onClick={() => { setLoading(true); setRefreshAttempt(previous => previous + 1); }} className="rounded-lg border border-rose-300/40 px-3 py-2 font-medium hover:bg-rose-300/10">Tentar novamente</button></div>}
      <p className="text-xs text-slate-400">Os valores são estimativas baseadas nos dados informados por você. A MYRYRA não consulta saldos bancários nem movimenta seu dinheiro.</p>
    </div>
  );
}
