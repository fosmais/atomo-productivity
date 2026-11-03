"use client";

import { useMemo, useState } from "react";

type Entry = { id: string; name: string; amount: number; kind: "income" | "expense" };

export default function MyryraFinanceStarter() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [kind, setKind] = useState<"income" | "expense">("expense");
  const totals = useMemo(() => entries.reduce((sum, item) => sum + (item.kind === "income" ? item.amount : -item.amount), 0), [entries]);
  const currency = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  const addEntry = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = Number(amount.replace(",", "."));
    if (!name.trim() || !Number.isFinite(parsed) || parsed <= 0) return;
    setEntries(previous => [{ id: crypto.randomUUID(), name: name.trim(), amount: parsed, kind }, ...previous]);
    setName("");
    setAmount("");
  };

  return (
    <div className="min-w-0 space-y-4">
      <div className="rounded-xl border border-amber-400/30 bg-amber-400/5 p-3 text-sm text-amber-100">
        Prévia MVP2: lançamentos apenas nesta sessão. Ainda não há salvamento na conta, sincronização bancária ou movimentação de dinheiro.
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/15 bg-slate-900/75 p-5">
          <p className="text-sm text-slate-300">Saldo simulado</p>
          <p className="mt-2 text-2xl font-semibold text-white">{currency(totals)}</p>
        </div>
        <div className="rounded-2xl border border-white/15 bg-slate-900/75 p-5">
          <p className="text-sm text-slate-300">Lançamentos nesta sessão</p>
          <p className="mt-2 text-2xl font-semibold text-white">{entries.length}</p>
        </div>
      </div>
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
        <button type="submit" className="rounded-xl bg-violet-600 px-4 py-2 font-medium text-white hover:bg-violet-500">Adicionar lançamento</button>
      </form>
      <div className="rounded-2xl border border-white/15 bg-slate-900/75 p-4 sm:p-5">
        <h3 className="mb-3 font-semibold text-white">Movimentações simuladas</h3>
        {entries.length === 0 ? <p className="text-sm text-slate-400">Nenhum lançamento nesta sessão.</p> : <ul className="space-y-2">{entries.map(item => <li key={item.id} className="flex items-center justify-between gap-3 border-b border-white/10 py-2 text-sm"><span className="min-w-0 truncate text-slate-200">{item.name}</span><span className={item.kind === "income" ? "text-emerald-300" : "text-rose-300"}>{item.kind === "income" ? "+" : "−"} {currency(item.amount)}</span><button type="button" onClick={() => setEntries(previous => previous.filter(entry => entry.id !== item.id))} className="text-slate-400 underline hover:text-white">Excluir</button></li>)}</ul>}
      </div>
      <p className="text-xs text-slate-400">Próximas entregas: persistência segura por usuário, metas financeiras, assinaturas recorrentes, planejamento de despesas e orientação da MYKA.</p>
    </div>
  );
}
