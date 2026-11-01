"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { saveCloudPlan } from "@/lib/plan-cloud";
import { useVyraNavigation } from "./vyra-module-context";

type TaskStatus = "todo" | "in_progress" | "waiting" | "done";

type KanbanTask = {
  id: string;
  title: string;
  priority: string;
  due_date: string | null;
  status: TaskStatus;
  completed_at: string | null;
};

function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

const columns: { status: TaskStatus; label: string }[] = [
  { status: "todo", label: "A fazer" },
  { status: "in_progress", label: "Em andamento" },
  { status: "waiting", label: "Aguardando" },
  { status: "done", label: "Concluído" },
];

export default function TaskKanban() {
  const { focusedTaskId } = useVyraNavigation();
  const [tasks, setTasks] = useState<KanbanTask[]>([]);
  const latestLoadRef = useRef(0);
  const [expandedColumns, setExpandedColumns] = useState<TaskStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState<"Alta" | "Média" | "Normal">("Normal");
  const [newDueDate, setNewDueDate] = useState("");
  const [creating, setCreating] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [taskSearch, setTaskSearch] = useState("");
  const [favoriteSavingId, setFavoriteSavingId] = useState<string | null>(null);

  const loadTasks = useCallback(async () => {
    const requestId = ++latestLoadRef.current;
    setLoading(true);
    setError("");

    try {
      const supabase = createClient();

      const { data: auth, error: authError } =
        await supabase.auth.getUser();

      if (authError || !auth.user) {
        throw new Error("Faça login para visualizar suas tarefas.");
      }

      const { data, error: tasksError } = await supabase
        .from("tasks")
        .select("id, title, priority, due_date, status, completed_at")
        .eq("user_id", auth.user.id)
        .order("created_at", { ascending: false })
        .limit(200);

      if (tasksError) throw tasksError;

      let loaded = (data ?? []) as KanbanTask[];
      // A busca global pode encontrar tarefas fora das 200 mais recentes.
      if (focusedTaskId && !loaded.some((task) => task.id === focusedTaskId)) {
        const { data: focusedTask, error: focusedError } = await supabase
          .from("tasks")
          .select("id, title, priority, due_date, status, completed_at")
          .eq("user_id", auth.user.id)
          .eq("id", focusedTaskId)
          .maybeSingle();
        if (focusedError) throw focusedError;
        if (focusedTask) loaded = [focusedTask as KanbanTask, ...loaded];
      }

      const { data: favoriteRows, error: favoritesError } = await supabase.from("favorites")
        .select("task_id").eq("user_id", auth.user.id).not("task_id", "is", null);
      if (favoritesError) throw favoritesError;
      if (requestId === latestLoadRef.current) {
        setTasks(loaded);
        setFavoriteIds((favoriteRows ?? []).flatMap((row) => row.task_id ? [row.task_id as string] : []));
      }
    } catch (err) {
      if (requestId === latestLoadRef.current) setError(
        err instanceof Error
          ? err.message
          : "Não foi possível carregar o Kanban."
      );
    } finally {
      if (requestId === latestLoadRef.current) setLoading(false);
    }
  }, [focusedTaskId]);

  useEffect(() => {
    void loadTasks();
    const refresh = () => { void loadTasks(); };
    window.addEventListener("myryra:tasks-updated", refresh);
    return () => {
      ++latestLoadRef.current;
      window.removeEventListener("myryra:tasks-updated", refresh);
    };
  }, [loadTasks]);

  useEffect(() => {
    if (!focusedTaskId || loading) return;

    const elemento = document.getElementById(
      `vyra-task-${focusedTaskId}`
    );

    elemento?.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "nearest",
    });
  }, [focusedTaskId, loading, tasks]);

  async function createTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (creating || !newTitle.trim()) return;

    setCreating(true);
    setError("");

    try {
      await saveCloudPlan("Tarefas manuais", [{
        id: crypto.randomUUID(),
        title: newTitle.trim(),
        priority: newPriority,
        dueDate: newDueDate || null,
        completed: false,
      }]);

      setNewTitle("");
      setNewPriority("Normal");
      setNewDueDate("");
      setShowCreate(false);
      await loadTasks();
      window.dispatchEvent(new Event("myryra:tasks-updated"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar tarefa.");
    } finally {
      setCreating(false);
    }
  }
  async function rescheduleTask(id: string, dueDate: string) {
    if (savingId) return;
    const previous = tasks;
    setSavingId(id);
    setError("");
    setTasks(current => current.map(task => task.id === id ? { ...task, due_date: dueDate } : task));
    try {
      const supabase = createClient();
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) throw new Error("Usuário não autenticado.");
      const { data, error: updateError } = await supabase.from("tasks")
        .update({ due_date: dueDate }).eq("id", id).eq("user_id", auth.user.id)
        .select("id").single();
      if (updateError || !data) throw new Error(updateError?.message ?? "Não foi possível reagendar.");
      window.dispatchEvent(new Event("myryra:tasks-updated"));
    } catch (err) {
      setTasks(previous);
      setError(err instanceof Error ? err.message : "Erro ao reagendar tarefa.");
    } finally {
      setSavingId(null);
    }
  }
  async function toggleFavorite(task: KanbanTask) {
    if (favoriteSavingId) return;
    setFavoriteSavingId(task.id);
    setError("");
    try {
      const supabase = createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error("Faça login para salvar favoritos.");
      if (favoriteIds.includes(task.id)) {
        const { error: removeError } = await supabase.from("favorites")
          .delete().eq("user_id", user.id).eq("task_id", task.id);
        if (removeError) throw removeError;
        setFavoriteIds((ids) => ids.filter((id) => id !== task.id));
      } else {
        const { error: insertError } = await supabase.from("favorites")
          .insert({ user_id: user.id, task_id: task.id, event_id: null });
        if (insertError) throw insertError;
        setFavoriteIds((ids) => [...ids, task.id]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível atualizar o favorito.");
    } finally {
      setFavoriteSavingId(null);
    }
  }

  async function deleteTask(task: KanbanTask) {
    if (savingId || !window.confirm(`Excluir a tarefa "${task.title}"? Esta ação não pode ser desfeita.`)) return;
    setSavingId(task.id);
    setError("");
    try {
      const supabase = createClient();
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) throw new Error("Usuário não autenticado.");
      const { data, error: deleteError } = await supabase
        .from("tasks")
        .delete()
        .eq("id", task.id)
        .eq("user_id", auth.user.id)
        .select("id")
        .single();
      if (deleteError || !data) throw new Error(deleteError?.message ?? "Não foi possível excluir a tarefa.");
      setTasks((current) => current.filter((item) => item.id !== task.id));
      window.dispatchEvent(new Event("myryra:tasks-updated"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível excluir a tarefa.");
    } finally {
      setSavingId(null);
    }
  }

  async function moveTask(id: string, status: TaskStatus) {
    if (savingId) return;

    const currentTask = tasks.find((task) => task.id === id);
    if (!currentTask || currentTask.status === status) return;

    const completionDate =
      status === "done" ? new Date().toISOString() : null;

    const previous = tasks;
    setSavingId(id);
    setError("");

    setTasks((current) =>
      current.map((task) =>
        task.id === id
          ? { ...task, status, completed_at: completionDate }
          : task
      )
    );

    try {
      const supabase = createClient();

      const { data: auth, error: authError } =
        await supabase.auth.getUser();

      if (authError || !auth.user) {
        throw new Error("Usuário não autenticado.");
      }

      const { data, error: updateError } = await supabase
        .from("tasks")
        .update({
          status,
          completed: status === "done",
          completed_at: completionDate,
        })
        .eq("id", id)
        .eq("user_id", auth.user.id)
        .select("id")
        .single();

      if (updateError || !data) {
        throw new Error(
          updateError?.message ?? "Não foi possível atualizar a tarefa."
        );
      }
      window.dispatchEvent(new Event("myryra:tasks-updated"));
    } catch (err) {
      setTasks(previous);
      setError(
        err instanceof Error ? err.message : "Erro ao movimentar a tarefa."
      );
    } finally {
      setSavingId(null);
    }
  }

  return (
    <section className="min-w-0 rounded-2xl border border-violet-400/20 bg-slate-900/70 p-4 text-white sm:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-violet-400">
            MYRYRA
          </p>
          <h2 className="text-2xl font-bold">Pipeline de tarefas</h2>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate((value) => !value)}
          disabled={creating}
          className="rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          + Nova tarefa
        </button>

        <button
          type="button"
          onClick={() => void loadTasks()}
          disabled={loading || savingId !== null}
          className="rounded-lg border border-slate-600 px-3 py-2 text-sm disabled:opacity-50"
        >
          Atualizar
        </button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="min-w-[12rem] flex-1">
          <span className="sr-only">Buscar tarefas por nome</span>
          <input type="search" value={taskSearch} onChange={(event) => setTaskSearch(event.target.value)}
            placeholder="Buscar tarefas..." className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-400 focus-visible:outline-2 focus-visible:outline-violet-400" />
        </label>
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-300">
          <input type="checkbox" checked={favoritesOnly} onChange={(event) => setFavoritesOnly(event.target.checked)}
            className="accent-violet-500" />
          ★ Somente favoritos
        </label>
        {(taskSearch || favoritesOnly) && <button type="button" onClick={() => { setTaskSearch(""); setFavoritesOnly(false); }}
          className="rounded-lg border border-slate-600 px-3 py-2 text-xs text-slate-300 hover:bg-white/10">Limpar filtros</button>}
      </div>

      {showCreate && (
        <form onSubmit={createTask} className="mb-5 grid gap-3 rounded-xl border border-violet-500/40 bg-slate-950 p-4 sm:grid-cols-2">
          <label className="sm:col-span-2 text-sm">
            Título da tarefa
            <input
              value={newTitle}
              onChange={(event) => setNewTitle(event.target.value)}
              maxLength={200}
              required
              placeholder="O que você precisa fazer?"
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 p-3 text-white"
            />
          </label>
          <label className="text-sm">
            Prioridade
            <select
              value={newPriority}
              onChange={(event) => setNewPriority(event.target.value as "Alta" | "Média" | "Normal")}
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 p-3 text-white"
            >
              <option value="Normal">Normal</option>
              <option value="Média">Média</option>
              <option value="Alta">Alta</option>
            </select>
          </label>
          <label className="text-sm">
            Prazo (opcional)
            <input
              type="date"
              value={newDueDate}
              onChange={(event) => setNewDueDate(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 p-3 text-white"
            />
          </label>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <button type="submit" disabled={creating || !newTitle.trim()} className="rounded-lg bg-violet-600 px-5 py-2 font-semibold disabled:opacity-50">
              {creating ? "Salvando..." : "Criar tarefa"}
            </button>
            <button type="button" onClick={() => setShowCreate(false)} disabled={creating} className="rounded-lg border border-slate-600 px-5 py-2">
              Cancelar
            </button>
          </div>
        </form>
      )}
      {error && (
        <p role="alert" className="mb-4 text-sm text-red-400">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-slate-400">Carregando tarefas...</p>
      ) : (
        <div className="grid min-w-0 gap-4 md:grid-cols-2 2xl:grid-cols-4">
          {columns.map((column) => {
            const columnTasks = tasks.filter(
              (task) => task.status === column.status && (!favoritesOnly || favoriteIds.includes(task.id)) && task.title.toLocaleLowerCase("pt-BR").includes(taskSearch.trim().toLocaleLowerCase("pt-BR"))
            );
            const expanded = expandedColumns.includes(column.status);
            const visibleTasks = expanded ? columnTasks : columnTasks.filter((task) => task.id === focusedTaskId).concat(columnTasks.filter((task) => task.id !== focusedTaskId).slice(0, focusedTaskId && columnTasks.some((task) => task.id === focusedTaskId) ? 3 : 4));

            return (
              <div
                key={column.status}
                className="min-w-0 min-h-56 rounded-xl border border-white/10 bg-slate-800/65 p-3 sm:p-4"
              >
                <h3 className="mb-4 flex items-center justify-between gap-2 text-sm font-semibold">
                  {column.label}
                  <span className="rounded-full border border-violet-400/20 bg-violet-500/10 px-2 py-0.5 text-xs tabular-nums text-violet-200">{columnTasks.length}</span>
                </h3>

                <div className="space-y-3">
                  {visibleTasks.map((task) => (
                    <article
                      key={task.id}
                      id={`vyra-task-${task.id}`}
                      className={`min-w-0 rounded-xl border p-3.5 transition-all duration-300 ${
                        focusedTaskId === task.id
                          ? "border-violet-400 bg-violet-500/15 ring-2 ring-violet-400/50 shadow-lg shadow-violet-500/20"
                          : "border-slate-600 bg-slate-900"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 break-words text-sm font-semibold leading-snug">{task.title}</p>
                        <button type="button" onClick={() => void toggleFavorite(task)} disabled={favoriteSavingId !== null}
                          aria-pressed={favoriteIds.includes(task.id)}
                          aria-label={favoriteIds.includes(task.id) ? `Remover ${task.title} dos favoritos` : `Favoritar ${task.title}`}
                          title={favoriteIds.includes(task.id) ? "Remover favorito" : "Adicionar favorito"}
                          className={`shrink-0 rounded-md px-1.5 text-xl transition hover:bg-violet-500/15 disabled:opacity-50 ${favoriteIds.includes(task.id) ? "text-amber-300" : "text-slate-400"}`}>
                          {favoriteIds.includes(task.id) ? "★" : "☆"}
                        </button>
                      </div>

                      <p className="mt-2 text-xs text-slate-300">
                        Prioridade: {task.priority}
                      </p>

                      {task.due_date && (
                        <p className="mt-1 text-xs text-slate-400">
                          Prazo: {task.due_date}
                        </p>
                      )}

                      {task.status !== "done" && task.due_date && task.due_date < localDateKey(new Date()) && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button type="button" disabled={savingId !== null} onClick={() => void rescheduleTask(task.id, localDateKey(new Date()))} className="rounded-md border border-violet-400/40 px-2 py-1 text-xs text-violet-200 hover:bg-violet-500/15 disabled:opacity-50">Reagendar para hoje</button>
                          <button type="button" disabled={savingId !== null} onClick={() => { const date = new Date(); date.setDate(date.getDate() + 1); void rescheduleTask(task.id, localDateKey(date)); }} className="rounded-md border border-slate-500 px-2 py-1 text-xs text-slate-200 hover:bg-slate-700 disabled:opacity-50">Amanhã</button>
                        </div>
                      )}
                      <label className="mt-3 block text-xs text-slate-300">
                        Mover para
                        <select
                          value={task.status}
                          disabled={savingId !== null}
                          onChange={(event) =>
                            void moveTask(
                              task.id,
                              event.target.value as TaskStatus
                            )
                          }
                          className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 p-2 text-sm"
                        >
                          {columns.map((option) => (
                            <option
                              key={option.status}
                              value={option.status}
                            >
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="mt-3 flex justify-end">
                        <button type="button" disabled={savingId !== null} onClick={() => void deleteTask(task)} aria-label={`Excluir tarefa: ${task.title}`} className="rounded-lg border border-rose-400/35 px-3 py-1.5 text-xs font-medium text-rose-200 transition hover:bg-rose-500/10 disabled:opacity-50">Excluir tarefa</button>
                      </div>
                    </article>
                  ))}

                  {columnTasks.length > 4 && (
                    <button type="button" aria-expanded={expanded}
                      onClick={() => setExpandedColumns((current) => expanded ? current.filter((status) => status !== column.status) : [...current, column.status])}
                      className="w-full rounded-lg border border-violet-500/40 px-3 py-2 text-sm text-violet-200 hover:bg-violet-500/10">
                      {expanded ? "Mostrar menos" : `Ver todas (${columnTasks.length})`}
                    </button>
                  )}
                  {columnTasks.length === 0 && (
                    <p className="text-xs text-slate-400">
                      Nenhuma tarefa nesta etapa.
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
