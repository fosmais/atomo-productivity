"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Subscription = { id: string; title: string; amount_cents: number; billing_cycle: "monthly" | "yearly"; next_due_date: string };
const brl = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
function parseMoney(value: string) {
  const input = value.trim().replace(/^R\$\s*/i, "").replace(/\s/g, "");
  let normalized = "";
  if (/^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(input)) normalized = input.replace(/\./g, "").replace(",", ".");
  else if (/^\d+(?:[.,]\d{1,2})?$/.test(input)) normalized = input.replace(",", ".");
  else return null;
  const [whole, decimal = ""] = normalized.split(".");
  const cents = Number(whole) * 100 + Number(decimal.padEnd(2, "0"));
  return Number.isSafeInteger(cents) && cents > 0 && cents <= 100000000000 ? cents : null;
}
export default function FinanceSubscriptions() {
  const [items, setItems] = useState<Subscription[]>([]);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");
  const [due, setDue] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const monthlyCents = useMemo(() => items.reduce((sum, item) => sum + (item.billing_cycle === "monthly" ? Number(item.amount_cents) : Number(item.amount_cents) / 12), 0), [items]);
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const db = createClient();
        const { data: auth, error: authError } = await db.auth.getUser();
        if (authError || !auth.user) throw new Error("Sessão inválida");
        const { data, error: queryError } = await db.from("myryra_finance_subscriptions").select("id,title,amount_cents,billing_cycle,next_due_date").eq("user_id", auth.user.id).order("next_due_date", { ascending: true }).limit(200);
        if (queryError) throw queryError;
        if (active) setItems((data ?? []) as Subscription[]);
      } catch { if (active) setError("Não foi possível carregar suas assinaturas."); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, []);
  async function add(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cents = parseMoney(amount);
    if (!title.trim() || title.trim().length > 100 || !cents || !/^\d{4}-\d{2}-\d{2}$/.test(due) || Number.isNaN(Date.parse(due + "T12:00:00"))) {
      setError("Informe descrição, valor e data válidos."); return;
    }
    setBusy(true); setError("");
    try {
      const db = createClient();
      const { data: auth, error: authError } = await db.auth.getUser();
      if (authError || !auth.user) throw new Error("Sessão inválida");
      const { data, error: insertError } = await db.from("myryra_finance_subscriptions").insert({ user_id: auth.user.id, title: title.trim(), amount_cents: cents, billing_cycle: cycle, next_due_date: due }).select("id,title,amount_cents,billing_cycle,next_due_date").single();
      if (insertError) throw insertError;
      setItems(previous => [...previous, data as Subscription].sort((a, b) => a.next_due_date.localeCompare(b.next_due_date)));
      setTitle(""); setAmount(""); setDue("");
    } catch { setError("Não foi possível salvar a assinatura."); }
    finally { setBusy(false); }
  }
  async function remove(id: string) {
    setError("");
    try {
      const db = createClient();
      const { error: deleteError } = await db.from("myryra_finance_subscriptions").delete().eq("id", id);
      if (deleteError) throw deleteError;
      setItems(previous => previous.filter(item => item.id !== id));
    } catch { setError("Não foi possível excluir a assinatura."); }
  }
  return <section className="space-y-4 rounded-2xl border border-white/15 bg-slate-900/75 p-4 sm:p-5">
    <div><p className="text-xs font-semibold uppercase tracking-widest text-violet-300">MYRYRA FINANCE</p><h3 className="mt-1 text-lg font-semibold text-white">Assinaturas recorrentes</h3><p className="mt-1 text-sm text-slate-400">Controle serviços e compromissos recorrentes. Os vencimentos são informativos; não há cobrança ou pagamento automático.</p></div>
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-xl border border-white/10 bg-slate-950/50 p-4"><p className="text-sm text-slate-400">Custo mensal equivalente</p><p className="mt-2 text-xl font-semibold text-white">{brl(monthlyCents)}</p></div>
      <div className="rounded-xl border border-white/10 bg-slate-950/50 p-4"><p className="text-sm text-slate-400">Custo anual estimado</p><p className="mt-2 text-xl font-semibold text-white">{brl(monthlyCents * 12)}</p></div>
      <div className="rounded-xl border border-white/10 bg-slate-950/50 p-4"><p className="text-sm text-slate-400">Assinaturas cadastradas</p><p className="mt-2 text-xl font-semibold text-white">{items.length}</p></div>
    </div>
    <form onSubmit={add} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <label className="text-sm text-slate-300">Serviço ou assinatura<input required maxLength={100} value={title} onChange={event => setTitle(event.target.value)} placeholder="Ex.: Streaming" className="mt-1 w-full rounded-xl border border-white/20 bg-slate-950 p-3 text-white"/></label>
      <label className="text-sm text-slate-300">Valor (R$)<input required inputMode="decimal" value={amount} onChange={event => setAmount(event.target.value)} placeholder="Ex.: R$ 49,90" className="mt-1 w-full rounded-xl border border-white/20 bg-slate-950 p-3 text-white"/></label>
      <label className="text-sm text-slate-300">Recorrência<select value={cycle} onChange={event => setCycle(event.target.value as "monthly" | "yearly")} className="mt-1 w-full rounded-xl border border-white/20 bg-slate-950 p-3 text-white"><option value="monthly">Mensal</option><option value="yearly">Anual</option></select></label>
      <label className="text-sm text-slate-300">Próximo vencimento<input required type="date" value={due} onChange={event => setDue(event.target.value)} className="mt-1 w-full rounded-xl border border-white/20 bg-slate-950 p-3 text-white"/></label>
      <button type="submit" disabled={busy || loading} className="rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50 sm:col-span-2 lg:col-span-4">{busy ? "Salvando..." : "Adicionar assinatura"}</button>
    </form>
    {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
    <ul className="space-y-2">{items.map(item => <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 p-3"><div className="min-w-0"><p className="truncate font-medium text-white">{item.title}</p><p className="text-xs text-slate-400">{item.billing_cycle === "monthly" ? "Mensal" : "Anual"} · Próximo vencimento: {item.next_due_date.split("-").reverse().join("/")}</p></div><div className="flex items-center gap-4"><span className="text-sm font-semibold text-white">{brl(item.amount_cents)}</span><button type="button" onClick={() => void remove(item.id)} className="text-xs text-violet-300 hover:text-white">Excluir</button></div></li>)}</ul>
    {!loading && items.length === 0 && <p className="text-sm text-slate-400">Nenhuma assinatura cadastrada.</p>}
  </section>;
}
