"use client";

import { useState } from "react";
import { getCloudPlans, saveCloudPlan } from "@/lib/plan-cloud";
import type { SavedTask } from "@/lib/plan-storage";

type GoogleTask = { id: string; listId: string; title: string; dueDate: string | null };
type GoogleList = { id: string; title: string };

export default function GoogleTasksImport() {
  const [lists, setLists] = useState<GoogleList[]>([]);
  const [tasks, setTasks] = useState<GoogleTask[]>([]);
  const [selectedList, setSelectedList] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [reconnect, setReconnect] = useState(false);
  const visible = tasks.filter(task => task.listId === selectedList);

  async function load() {
    setBusy(true); setMessage(""); setReconnect(false);
    try {
      const response = await fetch("/api/google/tasks", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) {
        if (data.code === "GOOGLE_TASKS_RECONSENT_REQUIRED") setReconnect(true);
        throw new Error(data.error || "Falha ao consultar tarefas.");
      }
      if (!data.connected) { setReconnect(true); throw new Error("Conecte sua conta Google primeiro."); }
      setLists(data.lists); setTasks(data.tasks); setSelectedList(data.lists[0]?.id || "");
      setLoaded(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao consultar tarefas.");
    } finally { setBusy(false); }
  }

  async function importSelected() {
    if (busy || !visible.length || !window.confirm(`Importar até ${Math.min(visible.length, 200)} tarefas desta lista para sua conta MYRYRA?`)) return;
    setBusy(true); setMessage("");
    try {
      const existing = await getCloudPlans();
      const keys = new Set(existing.flatMap(plan => plan.tasks.map(task => task.title.trim().toLocaleLowerCase("pt-BR") + "|" + (task.dueDate || ""))));
      const unique: SavedTask[] = [];
      for (const task of visible) {
        const key = task.title.trim().toLocaleLowerCase("pt-BR") + "|" + (task.dueDate || "");
        if (keys.has(key)) continue;
        keys.add(key);
        unique.push({ id: crypto.randomUUID(), title: task.title, priority: "Normal", dueDate: task.dueDate, completed: false });
        if (unique.length === 200) break;
      }
      if (unique.length) await saveCloudPlan("Google Tasks · " + (lists.find(list => list.id === selectedList)?.title || "Importação"), unique);
      setMessage(unique.length ? `${unique.length} tarefa(s) importada(s). Duplicatas ignoradas.` : "Nenhuma tarefa nova: todas já existem.");
      window.dispatchEvent(new Event("myryra:tasks-updated"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha na importação.");
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-3 rounded-2xl border border-violet-400/20 bg-slate-950/50 p-4">
      <h3 className="font-semibold text-white">Google Tasks · Importação manual</h3>
      <p className="text-sm text-slate-300">Leitura sob demanda. Nenhuma tarefa será criada sem sua confirmação; não alteramos tarefas no Google.</p>
      <button type="button" disabled={busy} onClick={() => void load()} className="rounded-lg bg-violet-600 px-3 py-2 text-sm text-white disabled:opacity-50">{busy ? "Aguarde..." : "Consultar minhas listas"}</button>
      {reconnect && <a href="/api/google/connect" className="ml-3 text-sm text-violet-300 underline">Autorizar Google Tasks</a>}
      {loaded && <div className="space-y-2">
        <label htmlFor="google-tasks-list" className="block text-sm text-slate-200">Lista para importar</label>
        <select id="google-tasks-list" value={selectedList} onChange={event => setSelectedList(event.target.value)} className="w-full rounded-lg bg-slate-800 p-2 text-white">
          {lists.map(list => <option key={list.id} value={list.id}>{list.title}</option>)}
        </select>
        <p className="text-xs text-slate-300">{visible.length} tarefa(s) disponíveis. Prévia das primeiras 10:</p>
        <ul className="max-h-48 overflow-y-auto text-sm text-slate-300">{visible.slice(0, 10).map(task => <li key={task.id} className="border-b border-white/10 py-1">{task.title}</li>)}</ul>
        <button type="button" disabled={busy || !visible.length} onClick={() => void importSelected()} className="rounded-lg bg-violet-600 px-3 py-2 text-sm text-white disabled:opacity-50">Confirmar importação</button>
      </div>}
      {message && <p role="status" className="text-sm text-amber-200">{message}</p>}
    </div>
  );
}
