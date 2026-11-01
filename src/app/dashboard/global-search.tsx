"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useVyraNavigation } from "./vyra-module-context";

type SearchResult = { id: string; title: string; kind: "Tarefa" | "Plano" | "Compromisso"; detail: string };

export default function GlobalSearch() {
  const { navigateTo, navigateToTask } = useVyraNavigation();
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const isOpen = expanded;
  const [results, setResults] = useState<SearchResult[]>([]);
  const [completedQuery, setCompletedQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); setCompletedQuery(""); setError(""); setLoading(false); return; }
    let active = true;
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const supabase = createClient();
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (authError || !auth.user) throw new Error("Faça login para pesquisar.");
        const needle = query.trim().toLocaleLowerCase("pt-BR");
        // Escape LIKE wildcards so user input is searched literally.
        const pattern = `%${query.trim().replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
        const [tasks, plans, events] = await Promise.all([
          supabase.from("tasks").select("id,title,due_date").eq("user_id", auth.user.id).ilike("title", pattern).order("created_at", { ascending: false }).limit(30),
          supabase.from("plans").select("id,title").eq("user_id", auth.user.id).ilike("title", pattern).order("created_at", { ascending: false }).limit(30),
          supabase.from("events").select("id,title,starts_at").eq("user_id", auth.user.id).ilike("title", pattern).order("starts_at", { ascending: false }).limit(30),
        ]);
        if (controller.signal.aborted) return;
        if (tasks.error || plans.error || events.error) throw new Error(tasks.error?.message ?? plans.error?.message ?? events.error?.message ?? "Erro ao buscar.");
        const all: SearchResult[] = [
          ...(tasks.data ?? []).map(t => ({ id: t.id, title: t.title, kind: "Tarefa" as const, detail: t.due_date ? `Prazo: ${t.due_date}` : "Sem prazo" })),
          ...(plans.data ?? []).map(p => ({ id: p.id, title: p.title, kind: "Plano" as const, detail: "Plano salvo" })),
          ...(events.data ?? []).map(e => ({ id: e.id, title: e.title, kind: "Compromisso" as const, detail: new Date(e.starts_at).toLocaleDateString("pt-BR") })),
        ];
        if (active) {
          const matching = all.filter(item => item.title.toLocaleLowerCase("pt-BR").includes(needle));
          const groups = (["Tarefa", "Plano", "Compromisso"] as const).map(kind => matching.filter(item => item.kind === kind));
          const balanced: SearchResult[] = [];
          for (let index = 0; balanced.length < 30 && groups.some(group => index < group.length); index++) {
            for (const group of groups) {
              if (group[index] && balanced.length < 30) balanced.push(group[index]);
            }
          }
          setResults(balanced);
          setCompletedQuery(query.trim());
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Falha na pesquisa.");
      } finally { if (active) setLoading(false); }
    }, 300);
    return () => { active = false; controller.abort(); clearTimeout(timeout); };
  }, [query]);

  return <div className="relative" aria-label="Busca global">
    <button type="button" aria-expanded={isOpen} aria-controls="myryra-global-search-panel" aria-label={isOpen ? "Fechar busca global" : "Abrir busca global"} onClick={() => { setExpanded(!expanded); if (expanded) setQuery(""); }} className="inline-flex h-11 items-center gap-2 rounded-xl border border-violet-400/25 bg-violet-500/10 px-3 text-sm font-medium text-violet-100 transition hover:bg-violet-500/20 focus-visible:outline-2 focus-visible:outline-violet-400">
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/></svg>
      <span className="hidden sm:inline">Buscar</span>
    </button>
    {isOpen && <div id="myryra-global-search-panel" className="absolute right-0 top-full z-50 mt-3 w-[min(88vw,420px)] max-h-[70dvh] overflow-y-auto rounded-2xl border border-violet-400/30 bg-slate-950 p-4 shadow-2xl shadow-black/60">
      <div className="mb-3 flex items-center justify-between gap-3"><label htmlFor="myryra-global-search" className="text-sm font-semibold text-violet-100">Busca global</label><button type="button" onClick={() => { setExpanded(false); setQuery(""); }} className="rounded-lg px-2 py-1 text-xs text-slate-300 hover:bg-white/10" aria-label="Fechar busca">Fechar</button></div>
    <input id="myryra-global-search" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Busque tarefas, planos e compromissos..." className="mt-3 w-full rounded-xl border border-slate-600 bg-slate-950 p-3 text-sm text-white placeholder:text-slate-500 focus:border-violet-400 focus:outline-none" />
    {(loading || (query.trim().length >= 2 && completedQuery !== query.trim() && !error)) && <p role="status" className="mt-3 text-xs text-slate-400">Pesquisando...</p>}
    {error && <p role="alert" className="mt-3 text-sm text-rose-300">{error}</p>}
    {!loading && completedQuery === query.trim() && query.trim().length >= 2 && !error && <div className="mt-3 space-y-2" aria-live="polite">
      <p className="text-xs text-slate-400">{results.length} resultado(s) encontrado(s){results.length === 30 ? " (exibindo os primeiros 30)" : ""}</p>
      {results.map(item => <button type="button" key={`${item.kind}-${item.id}`} onClick={() => { setExpanded(false); setQuery(""); if (item.kind === "Tarefa" && navigateToTask) navigateToTask(item.id); else navigateTo(item.kind === "Compromisso" ? "vyra-calendar" : "vyra-planner"); }} className="block w-full rounded-lg border border-slate-700 bg-slate-950/60 p-3 text-left transition-colors hover:border-violet-400/50 hover:bg-violet-500/10 focus-visible:outline-2 focus-visible:outline-violet-400">
        <span className="text-xs font-semibold uppercase text-violet-300">{item.kind}</span>
        <p className="mt-1 text-sm font-medium text-white">{item.title}</p>
        <p className="mt-1 text-xs text-slate-400">{item.detail}</p>
      </button>)}
    </div>}
    </div>}
  </div>;
}
