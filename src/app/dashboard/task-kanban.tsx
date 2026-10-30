"use client";

import { useCallback, useEffect, useState } from "react";
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

const columns: { status: TaskStatus; label: string }[] = [
  { status: "todo", label: "A fazer" },
  { status: "in_progress", label: "Em andamento" },
  { status: "waiting", label: "Aguardando" },
  { status: "done", label: "Concluído" },
];

export default function TaskKanban() {
  const { focusedTaskId } = useVyraNavigation();
  const [tasks, setTasks] = useState<KanbanTask[]>([]);
  const [expandedColumns, setExpandedColumns] = useState<TaskStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState<"Alta" | "Média" | "Normal">("Normal");
  const [newDueDate, setNewDueDate] = useState("");
  const [creating, setCreating] = useState(false);

  const loadTasks = useCallback(async () => {
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

      setTasks((data ?? []) as KanbanTask[]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível carregar o Kanban."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTasks();
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
  }, [focusedTaskId, loading]);

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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar tarefa.");
    } finally {
      setCreating(false);
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
    <section className="rounded-xl border border-slate-700 bg-slate-900 p-6 text-white">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-violet-400">
            VYRA
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
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {columns.map((column) => {
            const columnTasks = tasks.filter(
              (task) => task.status === column.status
            );
            const expanded = expandedColumns.includes(column.status);
            const visibleTasks = expanded ? columnTasks : columnTasks.filter((task) => task.id === focusedTaskId).concat(columnTasks.filter((task) => task.id !== focusedTaskId).slice(0, focusedTaskId && columnTasks.some((task) => task.id === focusedTaskId) ? 3 : 4));

            return (
              <div
                key={column.status}
                className="min-h-56 rounded-xl bg-slate-800 p-3"
              >
                <h3 className="mb-4 flex justify-between text-sm font-semibold">
                  {column.label}
                  <span className="text-slate-400">{columnTasks.length}</span>
                </h3>

                <div className="space-y-3">
                  {visibleTasks.map((task) => (
                    <article
                      key={task.id}
                      id={`vyra-task-${task.id}`}
                      className={`rounded-lg border p-3 transition-all duration-300 ${
                        focusedTaskId === task.id
                          ? "border-violet-400 bg-violet-500/15 ring-2 ring-violet-400/50 shadow-lg shadow-violet-500/20"
                          : "border-slate-600 bg-slate-900"
                      }`}
                    >
                      <p className="text-sm font-semibold">{task.title}</p>

                      <p className="mt-2 text-xs text-slate-400">
                        Prioridade: {task.priority}
                      </p>

                      {task.due_date && (
                        <p className="mt-1 text-xs text-slate-400">
                          Prazo: {task.due_date}
                        </p>
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
