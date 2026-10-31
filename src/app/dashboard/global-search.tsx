"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getCloudEvents } from "@/lib/event-cloud";

type SearchResult = { id: string; title: string; kind: "Tarefa" | "Plano" | "Compromisso"; detail: string };

export default function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); setError(""); setLoading(false); return; }
    let active = true;
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const supabase = createClient();
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (authError || !auth.user) throw new Error("Faça login para pesquisar.");
        const [tasks, plans, events] = await Promise.all([
          supabase.from("tasks").select("id,title,due_date").eq("user_id", auth.user.id).order("created_at", { ascending: false }).limit(500),
          supabase.from("plans").select("id,title").eq("user_id", auth.user.id).order("created_at", { ascending: false }).limit(200),
          getCloudEvents(),
        ]);
        if (controller.signal.aborted) return;
        if (tasks.error || plans.error) throw new Error(tasks.error?.message ?? plans.error?.message ?? "Erro ao buscar.");
        const needle = query.trim().toLocaleLowerCase("pt-BR");
        const all: SearchResult[] = [
          ...(tasks.data ?? []).map(t => ({ id: t.id, title: t.title, kind: "Tarefa" as const, detail: t.due_date ? `Prazo: ${t.due_date}` : "Sem prazo" })),
          ...(plans.data ?? []).map(p => ({ id: p.id, title: p.title, kind: "Plano" as const, detail: "Plano salvo" })),
          ...events.map(e => ({ id: e.id, title: e.title, kind: "Compromisso" as const, detail: new Date(e.startsAt).toLocaleDateString("pt-BR") })),
        ];
        if (active) setResults(all.filter(item => item.title.toLocaleLowerCase("pt-BR").includes(needle)).slice(0, 30));
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Falha na pesquisa.");
      } finally { if (active) setLoading(false); }
    }, 300);
    return () => { active = false; controller.abort(); clearTimeout(timeout); };
  }, [query]);

  return <section className="rounded-2xl border border-violet-400/20 bg-slate-900/70 p-4 sm:p-5" aria-label="Busca global">
    <label htmlFor="myryra-global-search" className="text-sm font-semibold text-violet-100">Busca global</label>
    <input id="myryra-global-search" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Busque tarefas, planos e compromissos..." className="mt-3 w-full rounded-xl border border-slate-600 bg-slate-950 p-3 text-sm text-white placeholder:text-slate-500 focus:border-violet-400 focus:outline-none" />
    {loading && <p role="status" className="mt-3 text-xs text-slate-400">Pesquisando...</p>}
    {error && <p role="alert" className="mt-3 text-sm text-rose-300">{error}</p>}
    {!loading && query.trim().length >= 2 && !error && <div className="mt-3 space-y-2" aria-live="polite">
      <p className="text-xs text-slate-400">{results.length} resultado(s) encontrado(s){results.length === 30 ? " (exibindo os primeiros 30)" : ""}</p>
      {results.map(item => <div key={`${item.kind}-${item.id}`} className="rounded-lg border border-slate-700 bg-slate-950/60 p-3">
        <span className="text-xs font-semibold uppercase text-violet-300">{item.kind}</span>
        <p className="mt-1 text-sm font-medium text-white">{item.title}</p>
        <p className="mt-1 text-xs text-slate-400">{item.detail}</p>
      </div>)}
    </div>}
  </section>;
}
