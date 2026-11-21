"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type TrashedItem = { id: string; title: string; deleted_at: string; kind: "tasks" | "events" };

export default function MyryraTrash() {
  const [items, setItems] = useState<TrashedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) throw new Error("Faça login para consultar a lixeira.");
      const [tasks, events] = await Promise.all([
        supabase.from("tasks").select("id,title,deleted_at").eq("user_id", auth.user.id).not("deleted_at", "is", null).order("deleted_at", { ascending: false }).limit(100),
        supabase.from("events").select("id,title,deleted_at").eq("user_id", auth.user.id).not("deleted_at", "is", null).order("deleted_at", { ascending: false }).limit(100),
      ]);
      if (tasks.error || events.error) throw new Error(tasks.error?.message ?? events.error?.message);
      setItems([
        ...(tasks.data ?? []).map(item => ({ ...item, kind: "tasks" as const })),
        ...(events.data ?? []).map(item => ({ ...item, kind: "events" as const })),
      ].sort((a,b) => b.deleted_at.localeCompare(a.deleted_at)));
    } catch (err) { setError(err instanceof Error ? err.message : "Falha ao carregar lixeira."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void reload(); }, 0);
    return () => window.clearTimeout(timer);
  }, [reload]);

  async function restore(item: TrashedItem) {
    setBusy(item.id);
    setError("");
    try {
      const supabase = createClient();
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) throw new Error("Sessão expirada.");
      const { data, error: updateError } = await supabase.from(item.kind)
        .update({ deleted_at: null }).eq("id", item.id).eq("user_id", auth.user.id)
        .not("deleted_at", "is", null).select("id").single();
      if (updateError || !data) throw new Error(updateError?.message ?? "Não foi possível restaurar.");
      setItems(current => current.filter(other => !(other.id === item.id && other.kind === item.kind)));
      window.dispatchEvent(new Event(item.kind === "tasks" ? "myryra:tasks-updated" : "myryra:events-updated"));
    } catch (err) { setError(err instanceof Error ? err.message : "Falha ao restaurar."); }
    finally { setBusy(null); }
  }

  return <section className="rounded-2xl border border-violet-400/25 bg-slate-900/70 p-5 text-white" aria-label="Lixeira MYRYRA">
    <h3 className="text-lg font-semibold">Lixeira e recuperação</h3>
    <p className="mt-1 text-sm text-slate-300">Restaure tarefas e compromissos removidos. Nenhum item é apagado definitivamente nesta tela.</p>
    <button type="button" onClick={() => { setLoading(true); setError(""); void reload(); }} disabled={loading || busy !== null} className="mt-3 rounded-lg border border-violet-400/40 px-3 py-2 text-sm disabled:opacity-50">Atualizar lixeira</button>
    {error && <p role="alert" className="mt-3 text-sm text-rose-300">{error}</p>}
    {loading ? <p className="mt-3 text-sm">Carregando...</p> : items.length === 0 ? <p className="mt-3 text-sm text-slate-400">Sua lixeira está vazia.</p> :
      <ul className="mt-4 space-y-2">{items.map(item => <li key={item.kind + item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-700 p-3">
        <div className="min-w-0"><p className="break-words text-sm font-medium">{item.title}</p><p className="text-xs text-slate-400">{item.kind === "tasks" ? "Tarefa" : "Compromisso"} · Removido em {new Date(item.deleted_at).toLocaleString("pt-BR")}</p></div>
        <button type="button" disabled={busy !== null} onClick={() => void restore(item)} className="rounded-lg border border-violet-400/50 px-3 py-2 text-sm text-violet-100 disabled:opacity-50">Restaurar</button>
      </li>)}</ul>}
  </section>;
}
