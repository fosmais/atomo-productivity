"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Entry = { id: string; description: string; amount_cents: number; kind: "income" | "expense"; created_at: string };

export default function MyryraFinanceStarter() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const client = createClient();
        const { data: auth, error: authError } = await client.auth.getUser();
        if (authError || !auth.user) throw new Error("Faça login para acessar sua carteira.");
        const { data, error: queryError } = await client.from("myryra_finance_entries")
          .select("id,description,amount_cents,kind,created_at")
          .eq("user_id", auth.user.id).order("created_at", { ascending: false }).limit(200);
        if (queryError) throw queryError;
        if (mounted) setEntries((data ?? []) as Entry[]);
      } catch {
        if (mounted) setError("Não foi possível carregar os lançamentos. Tente atualizar a página.");
      } finally { if (mounted) setLoading(false); }
    };
    void load();
    return () => { mounted = false; };
  }, []);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [kind, setKind] = useState<"income" | "expense">("expense");
  const totals = useMemo(() => entries.reduce((sum, item) => sum + (item.kind === "income" ? item.amount_cents : -item.amount_cents), 0), [entries]);
  const currency = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  const addEntry = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = amount.trim().replace(",", ".");
    if (!/^\\d{1,9}(?:\\.\\d{1,2})?$/.test(normalized) || !name.trim() || name.trim().length > 100) {
      setError("Informe uma descrição e um valor positivo com até duas casas decimais.");
      return;
    }
    const cents = Math.round(Number(normalized) * 100);
    if (!Number.isSafeInteger(cents) || cents <= 0) return;
    setSaving(true); setError("");
    try {
      const client = createClient();
      const { data: auth, error: authError } = await client.auth.getUser();
      if (authError || !auth.user) throw new Error("Sessão expirada.");
      const { data, error: insertError } = await client.from("myryra_finance_entries")
        .insert({ user_id: auth.user.id, description: name.trim(), amount_cents: cents, kind })
        .select("id,description,amount_cents,kind,created_at").single();
      if (insertError) throw insertError;
      setEntries(previous => [data as Entry, ...previous]);
      setName(""); setAmount("");
    } catch { setError("Não foi possível salvar. Verifique sua conexão e tente novamente."); }
    finally { setSaving(false); }
  };

  const deleteEntry = async (id: string) => {
    setError("");
    try {
      const client = createClient();
      const { error: deleteError } = await client.from("myryra_finance_entries").delete().eq("id", id);
      if (deleteError) throw deleteError;
      setEntries(previous => previous.filter(item => item.id !== id));
    } catch { setError("Não foi possível excluir o lançamento."); }
  };

  return (
    <div className="min-w-0 space-y-4">
      <div className="rounded-xl border border-amber-400/30 bg-amber-400/5 p-3 text-sm text-amber-100">
        MVP2 em homologação: lançamentos salvos na sua conta. Não há conexão bancária nem movimentação de dinheiro.
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/15 bg-slate-900/75 p-5">
          <p className="text-sm text-slate-300">Saldo simulado</p>
          <p className="mt-2 text-2xl font-semibold text-white">{currency(totals / 100)}</p>
        </div>
        <div className="rounded-2xl border border-white/15 bg-slate-900/75 p-5">
          <p className="text-sm text-slate-300">Lançamentos carregados</p>
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
        <button type="submit" disabled={saving || loading} className="rounded-xl bg-violet-600 px-4 py-2 font-medium text-white hover:bg-violet-500">{saving ? "Salvando..." : "Adicionar lançamento"}</button>
      </form>
      <div className="rounded-2xl border border-white/15 bg-slate-900/75 p-4 sm:p-5">
        <h3 className="mb-3 font-semibold text-white">Seus lançamentos</h3>
        {entries.length === 0 ? <p className="text-sm text-slate-400">{loading ? "Carregando lançamentos..." : "Nenhum lançamento cadastrado."}</p> : <ul className="space-y-2">{entries.map(item => <li key={item.id} className="flex items-center justify-between gap-3 border-b border-white/10 py-2 text-sm"><span className="min-w-0 truncate text-slate-200">{item.description}</span><span className={item.kind === "income" ? "text-emerald-300" : "text-rose-300"}>{item.kind === "income" ? "+" : "−"} {currency(item.amount_cents / 100)}</span><button type="button" onClick={() => void deleteEntry(item.id)} className="text-slate-400 underline hover:text-white">Excluir</button></li>)}</ul>}
      </div>
      {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
      <p className="text-xs text-slate-400">Próximas entregas: metas financeiras, assinaturas recorrentes, planejamento de despesas e orientação da MYKA.</p>
    </div>
  );
}
