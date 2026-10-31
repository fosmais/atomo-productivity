"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Overdue = { id: string; title: string; due_date: string; priority: string };
function localDay(offset: number) {
  const d = new Date(); d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function SmartReplan() {
  const [items, setItems] = useState<Overdue[]>([]);
  const [dates, setDates] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const supabase = createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) throw new Error("Faça login para replanejar.");
        const { data, error: queryError } = await supabase.from("tasks").select("id,title,due_date,priority")
          .eq("user_id", user.id).eq("completed", false).lt("due_date", localDay(0)).order("due_date", { ascending: true }).limit(20);
        if (queryError) throw queryError;
        if (active) setItems((data ?? []).filter(item => !!item.due_date) as Overdue[]);
      } catch { if (active) setError("Não foi possível consultar tarefas atrasadas."); }
    }
    void load();
    const refresh = () => { void load(); };
    window.addEventListener("myryra:tasks-updated", refresh);
    return () => { active = false; window.removeEventListener("myryra:tasks-updated", refresh); };
  }, []);
  async function confirm(item: Overdue) {
    if (busy) return;
    const date = dates[item.id] || localDay(1);
    if (date < localDay(0)) { setError("Escolha uma data atual ou futura."); return; }
    setBusy(item.id); setError(""); setNotice("");
    try {
      const supabase = createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error("Sessão expirada.");
      const { data, error: updateError } = await supabase.from("tasks").update({ due_date: date })
        .eq("id", item.id).eq("user_id", user.id).eq("completed", false).select("id").single();
      if (updateError || !data) throw new Error("Não foi possível atualizar o prazo.");
      setItems(current => current.filter(task => task.id !== item.id));
      setNotice("Prazo atualizado. Sua tarefa foi mantida.");
      window.dispatchEvent(new Event("myryra:tasks-updated"));
    } catch (err) { setError(err instanceof Error ? err.message : "Erro ao reagendar."); }
    finally { setBusy(null); }
  }
  return <section className="rounded-2xl border border-violet-500/30 bg-slate-900 p-5 text-white" aria-label="Replanejamento inteligente">
    <p className="text-xs font-semibold uppercase tracking-widest text-violet-400">MYRYRA · REPLANEJAMENTO</p>
    <h3 className="mt-2 text-xl font-semibold">Reorganize o que ficou para trás.</h3>
    <p className="mt-1 text-sm text-slate-300">Revise tarefas atrasadas e escolha uma nova data. Nenhuma alteração acontece sem sua confirmação.</p>
    {items.length ? <ul className="mt-4 space-y-3">{items.map(item => <li key={item.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-700 p-3">
      <div className="min-w-0 flex-1"><p className="text-sm font-medium">{item.title}</p><p className="text-xs text-slate-400">Venceu em {item.due_date} · {item.priority}</p></div>
      <input aria-label={`Novo prazo para ${item.title}`} type="date" min={localDay(0)} value={dates[item.id] || localDay(1)} onChange={event => setDates(current => ({ ...current, [item.id]: event.target.value }))} className="rounded-lg border border-slate-700 bg-slate-950 p-2 text-sm" />
      <button type="button" disabled={!!busy} onClick={() => void confirm(item)} className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold disabled:opacity-50">{busy === item.id ? "Salvando..." : "Confirmar prazo"}</button>
    </li>)}</ul> : <p className="mt-3 text-sm text-slate-400">Nenhuma tarefa atrasada encontrada.</p>}
    {error && <p role="alert" className="mt-3 text-sm text-rose-300">{error}</p>}
    {notice && <p role="status" className="mt-3 text-sm text-emerald-300">{notice}</p>}
    <p className="mt-3 text-xs text-slate-400">Versão inicial: replanejamento por data, sem alteração automática de horários ou compromissos.</p>
  </section>;
}
