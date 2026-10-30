"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getCloudPlans } from "@/lib/plan-cloud";
import { getCloudEvents } from "@/lib/event-cloud";
import { useVyraNavigation } from "./vyra-module-context";

type Item = { id: string; kind: "task" | "event"; title: string };
type Favorite = { id: string; task_id: string | null; event_id: string | null };

export default function FavoritesPanel() {
  const { navigateTo, navigateToTask } = useVyraNavigation();
  const [items, setItems] = useState<Item[]>([]);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function refresh() {
    const supabase = createClient();
    const [plans, events, auth] = await Promise.all([
      getCloudPlans(), getCloudEvents(), supabase.auth.getUser()
    ]);
    if (!auth.data.user) throw new Error("Sessão expirada.");
    const result = await supabase.from("favorites")
      .select("id,task_id,event_id").eq("user_id", auth.data.user.id);
    if (result.error) throw result.error;
    setFavorites(result.data ?? []);
    setItems([
      ...plans.flatMap(plan => plan.tasks.filter(task => !!task.id)
        .map(task => ({ id: task.id as string, kind: "task" as const, title: task.title }))),
      ...events.map(event => ({ id: event.id, kind: "event" as const, title: event.title }))
    ]);
  }

  useEffect(() => {
    let active = true;
    const reload = () => {
      if (!active) return;
      setLoading(true);
      void refresh().then(() => { if (active) setError(""); }).catch(err => {
        if (active) setError(err instanceof Error ? err.message : "Erro ao carregar.");
      }).finally(() => { if (active) setLoading(false); });
    };
    reload();
    window.addEventListener("myryra:tasks-updated", reload);
    window.addEventListener("myryra:events-updated", reload);
    return () => {
      active = false;
      window.removeEventListener("myryra:tasks-updated", reload);
      window.removeEventListener("myryra:events-updated", reload);
    };
  }, []);

  function find(item: Item) {
    return favorites.find(f => item.kind === "task" ? f.task_id === item.id : f.event_id === item.id);
  }

  async function toggle(item: Item) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const supabase = createClient();
      const existing = find(item);
      if (existing) {
        const result = await supabase.from("favorites").delete().eq("id", existing.id);
        if (result.error) throw result.error;
      } else {
        const auth = await supabase.auth.getUser();
        if (!auth.data.user) throw new Error("Sessão expirada.");
        const result = await supabase.from("favorites").insert({
          user_id: auth.data.user.id,
          task_id: item.kind === "task" ? item.id : null,
          event_id: item.kind === "event" ? item.id : null
        });
        if (result.error) throw result.error;
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mb-6 rounded-2xl border border-violet-500/30 bg-slate-900 p-5 text-white">
      <h3 className="text-xl font-semibold">★ Favoritos</h3>
      <p className="mt-1 text-sm text-slate-300">Acesse suas tarefas e seus compromissos importantes.</p>
      <button type="button" onClick={() => setShowAll(!showAll)}
        className="mt-3 rounded-lg border border-violet-500 px-3 py-2 text-sm">
        {showAll ? "Mostrar favoritos" : "Escolher favoritos"}
      </button>
      <label className="mt-3 block text-sm text-slate-300" htmlFor="myryra-favorites-search">Buscar tarefa ou compromisso</label>
      <input id="myryra-favorites-search" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar nos favoritos" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white placeholder:text-slate-500 focus-visible:outline-2 focus-visible:outline-violet-400" />
      {error && <p role="alert" className="mt-3 text-rose-300">{error}</p>}
      {loading && <p role="status" className="mt-3 text-sm text-slate-400">Carregando favoritos...</p>}
      {!loading && items.length === 0 && !error && <p className="mt-3 text-sm text-slate-400">Crie uma tarefa ou compromisso para começar.</p>}
      {!loading && items.length > 0 && !showAll && !items.some(item => find(item)) && <p className="mt-3 text-sm text-slate-400">Nenhum favorito ainda. Clique em Escolher favoritos.</p>}
      <ul aria-label={showAll ? "Selecionar favoritos" : "Itens favoritos"} className="mt-3 max-h-72 space-y-2 overflow-y-auto">
        {items.filter(item => (showAll || find(item)) && item.title.toLocaleLowerCase("pt-BR").includes(search.trim().toLocaleLowerCase("pt-BR"))).map(item => (
          <li key={item.kind + item.id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-950 p-3">
            <button type="button" onClick={() => item.kind === "task" ? navigateToTask?.(item.id) : navigateTo("vyra-calendar")} className="min-w-0 truncate text-left text-sm">
              {item.kind === "task" ? "Tarefa" : "Agenda"} · {item.title}
            </button>
            <button type="button" disabled={busy} aria-pressed={!!find(item)}
              aria-label={find(item) ? "Remover favorito" : "Adicionar favorito"}
              onClick={() => void toggle(item)}
              className="shrink-0 text-xl text-violet-300 disabled:opacity-50">
              {find(item) ? "★" : "☆"}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
