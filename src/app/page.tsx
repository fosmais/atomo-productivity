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

type Task = {
  id: number;
  title: string;
  priority: SavedTask["priority"];
  dueDate: string | null;
  done: boolean;
};

export default function Home() {
  const [text, setText] = useState("");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [savedPlans, setSavedPlans] = useState<SavedPlan[]>([]);
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      setSavedPlans(getSavedPlans());
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Não foi possível carregar os planos salvos."
      );
    }
  }, []);

  function generate() {
    const validation = validateTaskInput(text);

    if (!validation.valid) {
      setError(validation.error);
      return;
    }

    const result = validation.text
      .split(/\r?\n|[.!?]+/)
      .map((item) => item.trim())
      .filter((item) => item.length > 2)
      .slice(0, 30)
      .map((title, id) => ({
        id,
        title,
        priority: "Normal" as const,
        dueDate: null,
        done: false,
      }));

    setTasks(result);
    setError("");
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
            placeholder="Digite suas tarefas aqui..."
            className="mt-5 w-full rounded-xl border p-4"
          />

          {error && <p className="text-red-600">{error}</p>}

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              onClick={generate}
              className="rounded-xl bg-teal-600 px-6 py-3 font-semibold text-white"
            >
              Gerar plano de ação
            </button>

            <button
              onClick={() => {
                setText("Preparar apresentação.\nRevisar orçamento.\nAgendar reunião.");
                setTasks([]);
                setError("");
              }}
              className="rounded-xl border px-6 py-3"
            >
              Usar exemplo
            </button>

            <button
              onClick={() => {
                setText("");
                setTasks([]);
                setError("");
              }}
              className="rounded-xl border px-6 py-3"
            >
              Limpar
            </button>
          </div>
          <p className="mt-5 text-xs text-slate-500">
            Protótipo local baseado em regras, ainda sem IA.
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
