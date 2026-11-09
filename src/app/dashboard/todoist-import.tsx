"use client";

import { useState } from "react";
import { getCloudPlans, saveCloudPlan } from "@/lib/plan-cloud";
import type { SavedTask } from "@/lib/plan-storage";

type TodoistTask = { id: string; title: string; dueDate: string | null };

export default function TodoistImport() {
  const [tasks, setTasks] = useState<TodoistTask[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [needsConnection, setNeedsConnection] = useState(false);
  const selected = tasks.filter(task => selectedIds.includes(task.id));

  async function load() {
    setBusy(true); setMessage(""); setNeedsConnection(false); setLoaded(false); setHasMore(false); setNextCursor(null);
    try {
      const response = await fetch("/api/todoist/tasks", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) {
        if (data.code === "TODOIST_RECONNECT_REQUIRED") setNeedsConnection(true);
        throw new Error(data.error || "Não foi possível consultar o Todoist.");
      }
      if (!data.connected) {
        setNeedsConnection(true);
        throw new Error("Conecte o Todoist para consultar suas tarefas.");
      }
      setTasks(data.tasks);
      setHasMore(data.hasMore === true);
      setNextCursor(typeof data.nextCursor === "string" ? data.nextCursor : null);
      setSelectedIds([]);
      setLoaded(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro ao consultar Todoist.");
    } finally { setBusy(false); }
  }

  async function loadMore() {
    if (busy || !nextCursor) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/todoist/tasks?cursor=${encodeURIComponent(nextCursor)}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) {
        if (data.code === "TODOIST_RECONNECT_REQUIRED") setNeedsConnection(true);
        throw new Error(data.error || "Não foi possível carregar mais tarefas.");
      }
      if (!data.connected || !Array.isArray(data.tasks)) throw new Error("Resposta inválida do Todoist.");
      setTasks(current => {
        const ids = new Set(current.map(task => task.id));
        return [...current, ...data.tasks.filter((task: TodoistTask) => !ids.has(task.id))];
      });
      const cursor = typeof data.nextCursor === "string" ? data.nextCursor : null;
      if (cursor === nextCursor) throw new Error("Paginação do Todoist não avançou.");
      setNextCursor(cursor);
      setHasMore(Boolean(cursor));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro ao consultar Todoist.");
    } finally { setBusy(false); }
  }

  async function importSelected() {
    if (busy || !selected.length || !window.confirm(`Importar ${selected.length} tarefa(s) selecionada(s) para MYRYRA?`)) return;
    setBusy(true); setMessage("");
    try {
      const existing = await getCloudPlans();
      const keys = new Set(existing.flatMap(plan => plan.tasks.map(task =>
        task.title.trim().toLocaleLowerCase("pt-BR") + "|" + (task.dueDate || ""))));
      const unique: SavedTask[] = [];
      for (const task of selected) {
        const key = task.title.trim().toLocaleLowerCase("pt-BR") + "|" + (task.dueDate || "");
        if (keys.has(key)) continue;
        keys.add(key);
        unique.push({ id: crypto.randomUUID(), title: task.title, priority: "Normal", dueDate: task.dueDate, completed: false });
      }
      if (unique.length) await saveCloudPlan("Importação Todoist", unique);
      setMessage(unique.length ? `${unique.length} tarefa(s) importada(s). Duplicatas ignoradas.` : "Todas as tarefas selecionadas já existem.");
      window.dispatchEvent(new Event("myryra:tasks-updated"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível importar.");
    } finally { setBusy(false); }
  }

  return <div className="space-y-3 rounded-2xl border border-violet-400/20 bg-slate-950/50 p-4">
    <h3 className="font-semibold text-white">Todoist · Importação manual</h3>
    <p className="text-sm text-slate-300">Conecte sua conta e escolha as tarefas. A MYRYRA nunca altera suas tarefas no Todoist.</p>
    <button type="button" disabled={busy} onClick={() => void load()} className="rounded-lg bg-violet-600 px-3 py-2 text-sm text-white disabled:opacity-50">{busy ? "Aguarde..." : "Consultar Todoist"}</button>
    {needsConnection && <a href="/api/todoist/connect" className="ml-3 text-sm text-violet-300 underline">Conectar Todoist</a>}
    {loaded && <div className="space-y-2">
      <p className="text-xs text-slate-300">{tasks.length} tarefa(s) exibidas; {selected.length} selecionadas.</p>
      {hasMore && <p role="status" className="text-xs text-amber-200">Há mais tarefas no Todoist. Carregue as próximas páginas antes de selecionar todas.</p>}
      {hasMore && nextCursor && <button type="button" disabled={busy} onClick={() => void loadMore()} className="rounded-lg border border-violet-400/40 px-3 py-2 text-xs text-violet-200 disabled:opacity-50">Carregar mais tarefas</button>}
      <button type="button" onClick={() => setSelectedIds(tasks.map(task => task.id))} className="text-xs text-violet-300 underline">Selecionar todas</button>
      <button type="button" onClick={() => setSelectedIds([])} className="ml-3 text-xs text-violet-300 underline">Limpar seleção</button>
      <ul className="max-h-56 overflow-y-auto text-sm text-slate-300">{tasks.map(task => <li key={task.id} className="border-b border-white/10 py-1">
        <label className="flex items-start gap-2"><input type="checkbox" className="mt-1 accent-violet-500" checked={selectedIds.includes(task.id)}
          onChange={event => setSelectedIds(current => event.target.checked ? [...current, task.id] : current.filter(id => id !== task.id))} />
          <span>{task.title}{task.dueDate ? ` · ${task.dueDate}` : ""}</span></label>
      </li>)}</ul>
      <button type="button" disabled={busy || !selected.length} onClick={() => void importSelected()} className="rounded-lg bg-violet-600 px-3 py-2 text-sm text-white disabled:opacity-50">Confirmar importação</button>
    </div>}
    {message && <p role="status" className="text-sm text-amber-200">{message}</p>}
  </div>;
}
