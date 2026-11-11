"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { saveCloudPlan } from "@/lib/plan-cloud";
import { EVENT_CATEGORIES, type EventCategory } from "@/lib/event-categories";
import { useVyraNavigation } from "./vyra-module-context";

type TaskStatus = "todo" | "in_progress" | "waiting" | "done";

type KanbanTask = {
  id: string;
  title: string;
  priority: string;
  category: EventCategory;
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
  const [mobileColumn, setMobileColumn] = useState<TaskStatus>("todo");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editPriority, setEditPriority] = useState("Normal");
  const [editCategory, setEditCategory] = useState<EventCategory>("personal");
  const [editDueDate, setEditDueDate] = useState("");
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [favoriteOnCreate, setFavoriteOnCreate] = useState(false);
  const [newPriority, setNewPriority] = useState<"Alta" | "Média" | "Normal">("Normal");
  const [newDueDate, setNewDueDate] = useState("");
  const [creating, setCreating] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [taskSearch, setTaskSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [dashboardFilter, setDashboardFilter] = useState<"all" | "pending" | "overdue">("all");
  useEffect(() => {
    const apply = (event: Event) => {
      const filter = (event as CustomEvent<{ filter?: string }>).detail?.filter;
      if (filter !== "pending" && filter !== "overdue") return;
      // Consume the handoff even when this mounted board received the event directly.
      sessionStorage.removeItem("myryra:task-filter-pending");
      setDashboardFilter(filter);
      setTaskSearch("");
      setPriorityFilter("all");
      setFavoritesOnly(false);
      setMobileColumn("todo");
    };
    window.addEventListener("myryra:task-filter", apply);
    const pending = sessionStorage.getItem("myryra:task-filter-pending");
    if (pending === "pending" || pending === "overdue") {
      sessionStorage.removeItem("myryra:task-filter-pending");
      apply(new CustomEvent("myryra:task-filter", { detail: { filter: pending } }));
    }
    return () => window.removeEventListener("myryra:task-filter", apply);
  }, []);

  const [taskSort, setTaskSort] = useState<"priority" | "due" | "title" | "recent">("priority");
  const [favoriteSavingId, setFavoriteSavingId] = useState<string | null>(null);
  const [googleSavingId, setGoogleSavingId] = useState<string | null>(null);
  const [googleNotice, setGoogleNotice] = useState("");
  const [googleConsentRequired, setGoogleConsentRequired] = useState(false);
  async function sendTaskToGoogle(task: KanbanTask) {
    if (googleSavingId || !task.due_date || task.status === "done") return;
    if (!window.confirm(`Enviar a tarefa "${task.title}" ao Google Calendar como lembrete de dia inteiro em ${task.due_date}?`)) return;
    setGoogleSavingId(task.id);
    setGoogleNotice("");
    setGoogleConsentRequired(false);
    try {
      const response = await fetch("/api/google/tasks/sync-myryra", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: task.id }),
      });
      const result = await response.json() as { error?: string; code?: string; alreadyExists?: boolean; updated?: boolean };
      if (!response.ok) {
        if (result.code === "GOOGLE_WRITE_CONSENT_REQUIRED" || result.code === "GOOGLE_CALENDAR_RECONNECT_REQUIRED") setGoogleConsentRequired(true);
        throw new Error(result.error || "Falha na sincronização com Google Calendar.");
      }
      setGoogleNotice(result.updated ? "Lembrete atualizado no Google Calendar com o título e prazo atuais." : result.alreadyExists ? "Esta tarefa já está no Google Calendar." : "Tarefa enviada ao Google Calendar como lembrete de dia inteiro.");
    } catch (err) {
      setGoogleNotice(err instanceof Error ? err.message : "Falha ao enviar tarefa ao Google.");
    } finally {
      setGoogleSavingId(null);
    }
  }


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
        .select("id, title, priority, category, due_date, status, completed_at")
        .eq("user_id", auth.user.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(200);

      if (tasksError) throw tasksError;

      let loaded = (data ?? []) as KanbanTask[];
      // A busca global pode encontrar tarefas fora das 200 mais recentes.
      if (focusedTaskId && !loaded.some((task) => task.id === focusedTaskId)) {
        const { data: focusedTask, error: focusedError } = await supabase
          .from("tasks")
          .select("id, title, priority, category, due_date, status, completed_at")
          .eq("user_id", auth.user.id)
          .is("deleted_at", null)
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
        const focused = loaded.find((task) => task.id === focusedTaskId);
        if (focused) setMobileColumn(focused.status);
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
    let active = true;
    queueMicrotask(() => { if (active) void loadTasks(); });
    const refresh = () => { void loadTasks(); };
    window.addEventListener("myryra:tasks-updated", refresh);
    return () => {
      active = false;
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
  }, [focusedTaskId, loading, tasks, mobileColumn]);

  async function createTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (creating || !newTitle.trim()) return;

    setCreating(true);
    setError("");

    try {
      const savedPlan = await saveCloudPlan("Tarefas manuais", [{
        id: crypto.randomUUID(),
        title: newTitle.trim(),
        priority: newPriority,
        dueDate: newDueDate || null,
        completed: false,
      }]);

      if (favoriteOnCreate) {
        const createdTaskId = savedPlan.tasks[0]?.id;
        if (createdTaskId) {
          const supabase = createClient();
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { error: favoriteError } = await supabase.from("favorites").insert({ user_id: user.id, task_id: createdTaskId, event_id: null });
            if (favoriteError) setError("Tarefa criada, mas não foi possível favoritar. Use a estrela no quadro.");
          }
        }
      }
      setFavoriteOnCreate(false);
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
        .update({ due_date: dueDate }).eq("id", id).eq("user_id", auth.user.id).is("deleted_at", null)
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

  function beginEdit(task: KanbanTask) {
    setEditingId(task.id);
    setEditTitle(task.title);
    setEditPriority(task.priority);
    setEditCategory(task.category ?? "personal");
    setEditDueDate(task.due_date ?? "");
    setError("");
  }

  async function saveTaskEdits(task: KanbanTask) {
    if (savingId) return;
    const title = editTitle.trim();
    if (!title || title.length > 200 || !/[\p{L}\p{N}]/u.test(title)) {
      setError("Informe um título válido de até 200 caracteres.");
      return;
    }
    if (!["Alta", "Média", "Normal"].includes(editPriority)) {
      setError("Selecione uma prioridade válida.");
      return;
    }
    setSavingId(task.id);
    setError("");
    try {
      const supabase = createClient();
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) throw new Error("Usuário não autenticado.");
      const changes = { title, priority: editPriority, category: editCategory, due_date: editDueDate || null };
      const { data, error: updateError } = await supabase.from("tasks")
        .update(changes).eq("id", task.id).eq("user_id", auth.user.id)
        .is("deleted_at", null).select("id").single();
      if (updateError || !data) throw new Error(updateError?.message ?? "Não foi possível salvar.");
      setTasks(current => current.map(item => item.id === task.id ? { ...item, ...changes } : item));
      setEditingId(null);
      window.dispatchEvent(new Event("myryra:tasks-updated"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao editar tarefa.");
    } finally {
      setSavingId(null);
    }
  }

  async function deleteTask(task: KanbanTask) {
    if (savingId || !window.confirm(`Excluir a tarefa "${task.title}"? Você poderá recuperar na lixeira.`)) return;
    setSavingId(task.id);
    setError("");
    try {
      const supabase = createClient();
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) throw new Error("Usuário não autenticado.");
      const { data, error: deleteError } = await supabase
        .from("tasks")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", task.id)
        .eq("user_id", auth.user.id)
        .is("deleted_at", null)
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
        .is("deleted_at", null)
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
          aria-expanded={showCreate}
          className="rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {showCreate ? "Fechar formulário" : "+ Nova tarefa"}
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

      {dashboardFilter !== "all" && (
        <div className="mb-3 flex items-center justify-between gap-2 rounded-lg border border-violet-400/40 bg-violet-500/10 px-3 py-2 text-sm text-violet-100">
          <span>{dashboardFilter === "overdue" ? "Exibindo tarefas atrasadas" : "Exibindo tarefas pendentes"}</span>
          <button type="button" onClick={() => setDashboardFilter("all")} className="rounded border border-violet-400/40 px-2 py-1 text-xs">Ver todas</button>
        </div>
      )}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="min-w-[12rem] flex-1">
          <span className="sr-only">Buscar tarefas por nome</span>
          <input type="search" value={taskSearch} onChange={(event) => setTaskSearch(event.target.value)}
            placeholder="Buscar tarefas..." className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-400 focus-visible:outline-2 focus-visible:outline-violet-400" />
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          Prioridade
          <select aria-label="Filtrar tarefas por prioridade" value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)} className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white">
            <option value="all">Todas</option>
            <option value="Alta">Alta</option>
            <option value="Média">Média</option>
            <option value="Normal">Normal</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          Ordenar por
          <select aria-label="Ordenar tarefas" value={taskSort}
            onChange={(event) => setTaskSort(event.target.value as typeof taskSort)}
            className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white">
            <option value="priority">Prioridade: Alta → Média → Normal</option>
            <option value="due">Prazo: mais próximo</option>
            <option value="title">Nome: A–Z</option>
            <option value="recent">Mais recentes</option>
          </select>
        </label>
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-300">
          <input type="checkbox" checked={favoritesOnly} onChange={(event) => setFavoritesOnly(event.target.checked)}
            className="accent-violet-500" />
          ★ Somente favoritos
        </label>
        {(taskSearch || favoritesOnly || priorityFilter !== "all") && <button type="button" onClick={() => { setTaskSearch(""); setFavoritesOnly(false); setPriorityFilter("all"); }}
          className="rounded-lg border border-slate-600 px-3 py-2 text-xs text-slate-300 hover:bg-white/10">Limpar filtros</button>}
      </div>

      {showCreate && (
        <form onSubmit={createTask} aria-busy={creating} className="mb-5 grid min-w-0 gap-3 rounded-xl border border-violet-500/40 bg-slate-950 p-3 sm:grid-cols-2 sm:p-4">
          <label className="sm:col-span-2 text-sm">
            Título da tarefa
            <input
              value={newTitle}
              onChange={(event) => setNewTitle(event.target.value)}
              maxLength={200}
              required
              placeholder="O que você precisa fazer?"
              className="mt-1 min-h-11 w-full min-w-0 rounded-lg border border-slate-600 bg-slate-800 p-3 text-base text-white"
            />
          </label>
          <label className="text-sm">
            Prioridade
            <select
              value={newPriority}
              onChange={(event) => setNewPriority(event.target.value as "Alta" | "Média" | "Normal")}
              className="mt-1 min-h-11 w-full min-w-0 rounded-lg border border-slate-600 bg-slate-800 p-3 text-base text-white"
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
              className="mt-1 min-h-11 w-full min-w-0 rounded-lg border border-slate-600 bg-slate-800 p-3 text-base text-white"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-300 sm:col-span-2"><input type="checkbox" checked={favoriteOnCreate} onChange={(event) => setFavoriteOnCreate(event.target.checked)} className="accent-violet-500" />★ Adicionar aos favoritos</label>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <button type="submit" disabled={creating || !newTitle.trim()} className="min-h-11 flex-1 rounded-lg bg-violet-600 px-5 py-2 font-semibold disabled:opacity-50 sm:flex-none">
              {creating ? "Salvando..." : "Criar tarefa"}
            </button>
            <button type="button" onClick={() => setShowCreate(false)} disabled={creating} className="min-h-11 flex-1 rounded-lg border border-slate-600 px-5 py-2 sm:flex-none">
              Cancelar
            </button>
          </div>
        </form>
      )}
      {googleNotice && <p role="status" className="mb-3 text-sm text-violet-200">{googleNotice}</p>}
      {googleConsentRequired && (
        <a href="/api/google/connect?allow_event_creation=1" className="mb-3 inline-flex rounded-lg border border-violet-400 px-3 py-2 text-sm text-violet-100 hover:bg-violet-500/20">
          Autorizar envio de tarefas ao Google Calendar
        </a>
      )}
      {error && (
        <p role="alert" className="mb-4 text-sm text-red-400">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-slate-400">Carregando tarefas...</p>
      ) : (
        <div className="min-w-0">
          <div className="mb-3 flex snap-x snap-mandatory gap-2 overflow-x-auto overscroll-x-contain pb-2 lg:hidden" role="group" aria-label="Etapa do pipeline">
            {columns.map((column) => (
              <button key={column.status} type="button" aria-pressed={mobileColumn === column.status} onClick={() => setMobileColumn(column.status)}
                className={`min-h-10 shrink-0 snap-start rounded-xl border px-3 py-2 text-xs font-semibold sm:text-sm ${mobileColumn === column.status ? "border-violet-400 bg-violet-600 text-white" : "border-slate-600 bg-slate-800 text-slate-300"}`}>
                {column.label} ({tasks.filter((task) => task.status === column.status && (dashboardFilter === "all" || (task.status !== "done" && (dashboardFilter === "pending" || (!!task.due_date && task.due_date < localDateKey(new Date()))))) && (priorityFilter === "all" || task.priority === priorityFilter) && (!favoritesOnly || favoriteIds.includes(task.id)) && task.title.toLocaleLowerCase("pt-BR").includes(taskSearch.trim().toLocaleLowerCase("pt-BR"))).length})
              </button>
            ))}
          </div>
          <div className="grid min-w-0 gap-3 sm:gap-4 lg:grid-cols-2 2xl:grid-cols-4">
          {columns.map((column) => {
            const columnTasks = tasks.filter(
              (task) => task.status === column.status && (dashboardFilter === "all" || (task.status !== "done" && (dashboardFilter === "pending" || (!!task.due_date && task.due_date < localDateKey(new Date()))))) && (priorityFilter === "all" || task.priority === priorityFilter) && (!favoritesOnly || favoriteIds.includes(task.id)) && task.title.toLocaleLowerCase("pt-BR").includes(taskSearch.trim().toLocaleLowerCase("pt-BR"))
            );
            const priorityOrder: Record<string, number> = { Alta: 0, "Média": 1, Normal: 2, Baixa: 2 };
            columnTasks.sort((a, b) => {
              if (taskSort === "priority") {
                const diff = (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3);
                if (diff !== 0) return diff;
              }
              if (taskSort === "due" || taskSort === "priority") {
                const diff = (a.due_date ?? "9999-12-31").localeCompare(b.due_date ?? "9999-12-31");
                if (diff !== 0) return diff;
              }
              if (taskSort === "title") return a.title.localeCompare(b.title, "pt-BR");
              return 0;
            });
            const expanded = expandedColumns.includes(column.status);
            const visibleTasks = expanded ? columnTasks : columnTasks.filter((task) => task.id === focusedTaskId).concat(columnTasks.filter((task) => task.id !== focusedTaskId).slice(0, focusedTaskId && columnTasks.some((task) => task.id === focusedTaskId) ? 3 : 4));

            return (
              <div
                key={column.status}
                className={`min-w-0 rounded-xl border border-white/10 bg-slate-800/65 p-2.5 sm:p-4 ${mobileColumn === column.status ? "" : "hidden lg:block"}`}
              >
                <h3 className="mb-2 flex items-center justify-between gap-2 text-xs font-semibold sm:mb-3 sm:text-sm">
                  {column.label}
                  <span className="rounded-full border border-violet-400/20 bg-violet-500/10 px-2 py-0.5 text-xs tabular-nums text-violet-200">{columnTasks.length}</span>
                </h3>

                <div className="space-y-2 sm:space-y-3">
                  {visibleTasks.map((task) => (
                    <article
                      key={task.id}
                      id={`vyra-task-${task.id}`}
                      className={`min-w-0 rounded-xl border p-2.5 transition-all duration-300 sm:p-3.5 ${
                        focusedTaskId === task.id
                          ? "border-violet-400 bg-violet-500/15 ring-2 ring-violet-400/50 shadow-lg shadow-violet-500/20"
                          : "border-slate-600 bg-slate-900"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 break-words text-xs font-semibold leading-snug sm:text-sm">{task.title}</p>
                        <button type="button" onClick={() => void toggleFavorite(task)} disabled={favoriteSavingId !== null}
                          aria-pressed={favoriteIds.includes(task.id)}
                          aria-label={favoriteIds.includes(task.id) ? `Remover ${task.title} dos favoritos` : `Favoritar ${task.title}`}
                          title={favoriteIds.includes(task.id) ? "Remover favorito" : "Adicionar favorito"}
                          className={`shrink-0 rounded-md px-1.5 text-xl transition hover:bg-violet-500/15 disabled:opacity-50 ${favoriteIds.includes(task.id) ? "text-amber-300" : "text-slate-400"}`}>
                          {favoriteIds.includes(task.id) ? "★" : "☆"}
                        </button>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                        <span className={`rounded-full border px-2 py-1 font-medium ${task.priority === "Alta" ? "border-rose-400/40 bg-rose-500/15 text-rose-200" : task.priority === "Média" ? "border-amber-400/40 bg-amber-500/15 text-amber-200" : "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"}`} aria-label={`Prioridade ${task.priority}`}>● {task.priority}</span>
                        <span className="rounded-full border border-slate-500/40 bg-slate-700/40 px-2 py-1 text-slate-200" aria-label={`Categoria ${EVENT_CATEGORIES[task.category ?? "personal"].label}`}>{EVENT_CATEGORIES[task.category ?? "personal"].label}</span>
                      </div>

                      {task.due_date && (
                        <p className="mt-1 text-xs text-slate-400">
                          Prazo: {task.due_date}
                        </p>
                      )}

                      {task.status !== "done" && task.due_date && (
                        <button type="button" disabled={googleSavingId !== null}
                          onClick={() => void sendTaskToGoogle(task)}
                          className="mt-2 rounded-md border border-violet-400/40 px-2 py-1 text-xs text-violet-200 hover:bg-violet-500/15 disabled:opacity-50">
                          {googleSavingId === task.id ? "Enviando..." : "Enviar ao Google Calendar"}
                        </button>
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
                      {editingId === task.id && <div className="mt-3 space-y-2 rounded-lg border border-violet-400/40 bg-slate-950/80 p-3">
                        <label className="block text-xs text-slate-300">Título<input aria-label="Editar título da tarefa" maxLength={200} value={editTitle} onChange={event => setEditTitle(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 p-2 text-sm text-white" /></label>
                        <label className="block text-xs text-slate-300">Prioridade<select aria-label="Editar prioridade" value={editPriority} onChange={event => setEditPriority(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 p-2 text-sm text-white"><option value="Normal">Normal</option><option value="Média">Média</option><option value="Alta">Alta</option></select></label>
                        <label className="block text-xs text-slate-300">Categoria<select aria-label="Editar categoria" value={editCategory} onChange={event => setEditCategory(event.target.value as EventCategory)} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 p-2 text-sm text-white">{Object.entries(EVENT_CATEGORIES).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}</select></label>
                        <label className="block text-xs text-slate-300">Prazo<input aria-label="Editar prazo" type="date" value={editDueDate} onChange={event => setEditDueDate(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 p-2 text-sm text-white" /></label>
                        <div className="flex flex-wrap justify-end gap-2"><button type="button" disabled={savingId !== null} onClick={() => setEditingId(null)} className="min-h-10 rounded-lg border border-slate-600 px-4 py-2 text-sm">Cancelar</button><button type="button" disabled={savingId !== null} onClick={() => void saveTaskEdits(task)} className="min-h-10 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Salvar</button></div>
                      </div>}
                      <div className="mt-3 flex flex-wrap justify-end gap-2">
                        <button type="button" disabled={savingId !== null} onClick={() => editingId === task.id ? setEditingId(null) : beginEdit(task)} aria-label={`Editar tarefa: ${task.title}`} className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-violet-950/40 transition hover:bg-violet-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300 disabled:opacity-50">✎ Editar</button>
                        <button type="button" disabled={savingId !== null} onClick={() => void deleteTask(task)} aria-label={`Excluir tarefa: ${task.title}`} className="min-h-10 rounded-lg border border-rose-400/35 px-3 py-2 text-sm font-medium text-rose-200 transition hover:bg-rose-500/10 disabled:opacity-50">Excluir tarefa</button>
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
                      {taskSearch || favoritesOnly || priorityFilter !== "all" ? "Nenhuma tarefa corresponde aos filtros nesta etapa." : "Nenhuma tarefa nesta etapa."}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
          </div>
        </div>
      )}
    </section>
  );
}
