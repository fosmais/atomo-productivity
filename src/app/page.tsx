"use client";

import { useEffect, useState } from "react";
import { validateTaskInput } from "@/lib/task-validation";
import {
  deletePlan,
  getSavedPlans,
  savePlan,
  updateSavedPlan,
  type SavedPlan,
  type SavedTask,
} from "@/lib/plan-storage";
import { saveCloudPlan } from "@/lib/plan-cloud";

type Task = {
  id: number;
  title: string;
  priority: SavedTask["priority"];
  dueDate: string | null;
  done: boolean;
};

type GeneratedTask = Omit<Task, "id" | "done">;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isGeneratedTask(value: unknown): value is GeneratedTask {
  return (
    isRecord(value) &&
    typeof value.title === "string" &&
    value.title.trim().length > 0 &&
    (value.priority === "Alta" ||
      value.priority === "Média" ||
      value.priority === "Normal") &&
    (typeof value.dueDate === "string" || value.dueDate === null)
  );
}

export default function Home() {
  const [text, setText] = useState("");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [savedPlans, setSavedPlans] = useState<SavedPlan[]>([]);
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    Promise.resolve()
      .then(getSavedPlans)
      .then(
        (plans) => {
          if (active) setSavedPlans(plans);
        },
        (loadError: unknown) => {
          if (active) {
            setError(
              loadError instanceof Error
                ? loadError.message
                : "Não foi possível carregar os planos salvos."
            );
          }
        }
      );

    return () => {
      active = false;
    };
  }, []);

  async function generate() {
    if (loading) return;

    const validation = validateTaskInput(text);

    if (!validation.valid) {
      setError(validation.error);
      return;
    }

    setLoading(true);
    setTasks([]);
    setError("");

    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: validation.text }),
      });

      let data: unknown;

      try {
        data = await response.json();
      } catch {
        throw new Error("O servidor retornou uma resposta inválida.");
      }

      if (!response.ok) {
        const message =
          isRecord(data) && typeof data.error === "string"
            ? data.error
            : "Não foi possível gerar as tarefas. Tente novamente.";
        throw new Error(message);
      }

      if (
        !isRecord(data) ||
        !Array.isArray(data.tasks) ||
        !data.tasks.every(isGeneratedTask)
      ) {
        throw new Error("A API retornou um formato de tarefas inválido.");
      }

      const generated = data.tasks.slice(0, 10).map((task, id) => ({
        ...task,
        title: task.title.trim(),
        dueDate: task.dueDate?.trim() || null,
        id,
        done: false,
      }));

      if (generated.length === 0) {
        throw new Error("Nenhuma tarefa válida foi gerada.");
      }

      setTasks(generated);

      // Salva na nuvem sem impedir a exibição das tarefas.
      try {
        const cloudTasks = generated.map((task) => ({
          title: task.title,
          priority: task.priority,
          dueDate: task.dueDate,
          completed: task.done,
        }));

        const planName =
          validation.text.trim().slice(0, 100) || "Plano gerado por IA";

        await saveCloudPlan(planName, cloudTasks);
      } catch (cloudError) {
        console.error("Falha ao salvar plano na nuvem:", cloudError);
      }
    } catch (generateError) {
      setError(
        generateError instanceof Error
          ? generateError.message
          : "Ocorreu um erro inesperado. Tente novamente."
      );
    } finally {
      setLoading(false);
    }
  }

  function handleSavePlan() {
    try {
      const saved = savePlan(
        text.trim().split(/\r?\n|[.!?]/)[0].slice(0, 100),
        tasks.map(({ title, priority, dueDate, done }) => ({
          title,
          priority,
          dueDate,
          completed: done,
        }))
      );
      setSavedPlans(getSavedPlans());
      setActivePlanId(saved.id);
      setError("");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Não foi possível salvar o plano."
      );
    }
  }

  function handleDeletePlan(id: string) {
    try {
      deletePlan(id);
      setSavedPlans(getSavedPlans());
      setActivePlanId((current) => (current === id ? null : current));
      setError("");
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Não foi possível excluir o plano."
      );
    }
  }

  function handleUpdatePlan(plan: SavedPlan) {
    try {
      updateSavedPlan(plan);
      setSavedPlans(getSavedPlans());
      setError("");
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Não foi possível atualizar o plano."
      );
    }
  }

  const completed = tasks.filter((task) => task.done).length;
  const progress = tasks.length
    ? Math.round((completed / tasks.length) * 100)
    : 0;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b bg-white px-6 py-5">
        <div className="mx-auto max-w-5xl text-xl font-bold">
          <span className="text-teal-600">✦</span> Átomo Productivity
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-5 py-16">
        <div className="text-center">
          <h1 className="text-4xl font-extrabold sm:text-6xl">
            Menos anotações.
            <span className="block text-teal-600">
              Mais execução.
            </span>
          </h1>
          <p className="mt-6 text-lg text-slate-600">
            Transforme suas anotações em tarefas organizadas.
          </p>
        </div>

        <div className="mt-12 rounded-3xl border bg-white p-6 shadow-lg">
          <h2 className="text-xl font-bold">Suas anotações</h2>

          <textarea
            aria-label="Suas anotações"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setTasks([]);
              setError("");
            }}
            rows={7}
            maxLength={5000}
            disabled={loading}
            placeholder="Digite suas tarefas aqui..."
            className="mt-5 w-full rounded-xl border p-4 disabled:opacity-50"
          />

          {error && (
            <p role="alert" className="mt-4 text-sm text-red-600">
              {error}
            </p>
          )}

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={generate}
              disabled={loading}
              className="rounded-xl bg-teal-600 px-6 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Gerando com IA..." : "Gerar plano com IA"}
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={() => {
                setText("Preparar apresentação.\nRevisar orçamento.\nAgendar reunião.");
                setTasks([]);
                setError("");
              }}
              className="rounded-xl border px-6 py-3 disabled:opacity-50"
            >
              Usar exemplo
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={() => {
                setText("");
                setTasks([]);
                setError("");
              }}
              className="rounded-xl border px-6 py-3 disabled:opacity-50"
            >
              Limpar
            </button>
          </div>
          <p className="mt-5 text-xs text-slate-500">
            O texto será enviado a um provedor de IA para processamento. Não
            insira dados pessoais, bancários ou confidenciais.
          </p>
        </div>

        {tasks.length > 0 && (
          <div className="mt-8 rounded-3xl border bg-white p-6">
            <h2 className="text-2xl font-bold">Seu plano de ação</h2>
            <p className="mt-4">Progresso: {progress}%</p>

            <div className="mt-2 h-3 rounded-full bg-slate-100">
              <div
                className="h-3 rounded-full bg-teal-500"
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className="mt-6 space-y-3">
              {tasks.map((task) => (
                <label key={task.id} className="flex gap-3 rounded-xl bg-slate-50 p-4">
                  <input
                    type="checkbox"
                    checked={task.done}
                    onChange={() =>
                      setTasks((current) =>
                        current.map((item) =>
                          item.id === task.id
                            ? { ...item, done: !item.done }
                            : item
                        )
                      )
                    }
                  />
                  <span>
                    <span className={task.done ? "line-through text-slate-400" : ""}>
                      {task.title}
                    </span>
                    <span className="mt-1 block text-xs text-slate-500">
                      {task.priority}
                      {task.dueDate ? ` · Prazo: ${task.dueDate}` : ""}
                    </span>
                  </span>
                </label>
              ))}
            </div>

            <button
              type="button"
              onClick={handleSavePlan}
              className="mt-6 rounded-xl bg-teal-600 px-5 py-3 font-semibold text-white hover:bg-teal-700"
            >
              Salvar plano
            </button>
          </div>
        )}
      </section>

      <section className="mx-auto mt-12 max-w-4xl px-5 pb-12">
        <h2 className="mb-2 text-2xl font-bold text-slate-900">
          Histórico de planos
        </h2>

        <p className="mb-6 text-sm text-slate-500">
          Seus planos ficam salvos neste navegador.
        </p>

        {savedPlans.length === 0 ? (
          <div className="rounded-xl border border-slate-200 p-6 text-slate-500">
            Nenhum plano salvo ainda.
          </div>
        ) : (
          <div className="space-y-3">
            {savedPlans.map((plan) => (
              <div
                key={plan.id}
                className="rounded-xl border border-slate-200 bg-white p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-slate-900">{plan.name}</h3>

                    <p className="text-sm text-slate-500">
                      {plan.tasks.length} tarefas
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setActivePlanId(
                            activePlanId === plan.id ? null : plan.id
                        )
                      }
                      className="rounded-lg bg-teal-600 px-4 py-2 text-sm text-white"
                    >
                      {activePlanId === plan.id ? "Fechar" : "Abrir"}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeletePlan(plan.id)}
                      className="rounded-lg border border-red-200 px-4 py-2 text-sm text-red-600"
                    >
                      Excluir
                    </button>
                  </div>
                </div>

                {activePlanId === plan.id && (
                  <div className="mt-5 space-y-3 border-t border-slate-100 pt-4">
                    {plan.tasks.map((task, index) => (
                      <label
                        key={`${plan.id}-${index}`}
                        className="flex items-start gap-3 text-sm text-slate-700"
                      >
                        <input
                            type="checkbox"
                            checked={task.completed}
                            onChange={() => {
                              const updatedTasks = plan.tasks.map((item, i) =>
                                i === index
                                  ? { ...item, completed: !item.completed }
                                  : item
                              );

                              handleUpdatePlan({
                                ...plan,
                                tasks: updatedTasks,
                              });
                            }}
                        />

                        <span
                            className={
                              task.completed ? "line-through opacity-50" : ""
                            }
                        >
                            {task.title} — {task.priority}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
