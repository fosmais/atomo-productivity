"use client";

import { useEffect, useState } from "react";
import { getCloudPlans } from "@/lib/plan-cloud";
import {
  generateDailyPlan,
  type CopilotTask,
  type DailyPlan,
} from "@/lib/daily-planner";

export default function DailyCopilot() {
  const [hours, setHours] = useState(4);
  const [tasks, setTasks] = useState<CopilotTask[]>([]);
  const [plan, setPlan] = useState<DailyPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [recommendation, setRecommendation] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [aiError, setAiError] = useState("");

  async function handleRefreshTasks() {
    setLoading(true);
    setError("");
    setPlan(null);
    setRecommendation("");
    setAiError("");

    try {
      const plans = await getCloudPlans();

      const allTasks: CopilotTask[] = plans.flatMap((savedPlan) =>
        savedPlan.tasks
          .filter((task) => Boolean(task.id))
          .map((task) => ({
            id: task.id!,
            title: task.title,
            priority: task.priority,
            dueDate: task.dueDate,
            completed: task.completed,
          }))
      );

      setTasks(allTasks);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao atualizar tarefas."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;

    async function loadTasks() {
      try {
        const plans = await getCloudPlans();

        if (!active) return;

        const allTasks: CopilotTask[] = plans.flatMap((savedPlan) =>
          savedPlan.tasks
            .filter((task) => Boolean(task.id))
            .map((task) => ({
              id: task.id!,
              title: task.title,
              priority: task.priority,
              dueDate: task.dueDate,
              completed: task.completed,
            }))
        );

        setTasks(allTasks);
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error ? err.message : "Erro ao carregar tarefas."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadTasks();

    return () => {
      active = false;
    };
  }, []);

  function handleGenerate() {
    const today = new Date().toLocaleDateString("en-CA");
    const result = generateDailyPlan(tasks, hours * 60, today);

    setRecommendation("");
    setAiError("");
    setPlan(result);
  }

  async function handleAnalyze() {
    if (!plan || plan.items.length === 0 || analyzing) return;

    setAnalyzing(true);
    setAiError("");
    setRecommendation("");

    try {
      const response = await fetch("/api/copilot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          availableMinutes: plan.availableMinutes,
          tasks: plan.items.map((item) => ({
            title: item.title,
            priority: item.priority,
            estimatedMinutes: item.estimatedMinutes,
            reason: item.reason,
          })),
        }),
      });

      const data: unknown = await response.json();

      if (!response.ok) {
        const message =
          typeof data === "object" &&
          data !== null &&
          "error" in data &&
          typeof data.error === "string"
            ? data.error
            : "Não foi possível analisar o planejamento.";
        throw new Error(message);
      }

      if (
        typeof data !== "object" ||
        data === null ||
        !("recommendation" in data) ||
        typeof data.recommendation !== "string"
      ) {
        throw new Error("Resposta inválida da inteligência artificial.");
      }

      setRecommendation(data.recommendation);
    } catch (err) {
      setAiError(
        err instanceof Error
          ? err.message
          : "Erro ao consultar a inteligência artificial."
      );
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <section className="rounded-xl border border-slate-700 bg-slate-900 p-6 text-white">
      <div className="mb-4">
        <p className="text-sm font-semibold text-violet-400">MYRYRA PLANNER</p>
        <h2 className="text-2xl font-bold">Meu Dia Inteligente</h2>
        <p className="mt-2 text-sm text-slate-400">
          Organize suas prioridades de acordo com o tempo disponível.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="available-hours">Horas disponíveis:</label>

        <select
          id="available-hours"
          value={hours}
          onChange={(event) => {
            setHours(Number(event.target.value));
            setPlan(null);
          }}
          className="rounded bg-slate-800 p-2"
        >
          {Array.from({ length: 24 }, (_, index) => index + 1).map(
            (value) => (
              <option key={value} value={value}>
                {value} {value === 1 ? "hora" : "horas"}
              </option>
            )
          )}
        </select>

        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading || Boolean(error)}
          className="rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-3 font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
        >
          {loading ? "Carregando..." : "Planejar meu dia"}
        </button>
        <button
          type="button"
          onClick={handleRefreshTasks}
          disabled={loading}
          className="rounded border border-slate-600 px-4 py-2 font-semibold text-white disabled:opacity-50"
        >
          {loading ? "Atualizando..." : "Atualizar tarefas"}
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-4 text-red-400">
          {error}
        </p>
      )}

      {plan && (
        <div className="mt-6 space-y-4">
          <div className="rounded-lg bg-slate-800 p-4">
            <p>
              <strong>{plan.items.length}</strong> tarefas selecionadas
            </p>
            <p>
              Tempo estimado: <strong>{plan.totalMinutes} minutos</strong>
            </p>
            <p>
              Tarefas para depois: <strong>{plan.deferredCount}</strong>
            </p>
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={analyzing || plan.items.length === 0}
              className="rounded bg-violet-600 px-4 py-2 font-semibold text-white disabled:opacity-50"
            >
              {analyzing
                ? "Analisando seu dia..."
                : "✨ Analisar meu dia com IA"}
            </button>

            {aiError && (
              <p role="alert" className="text-sm text-red-400">
                {aiError}
              </p>
            )}

            {recommendation && (
              <div className="rounded-lg border border-violet-700 bg-slate-800 p-4">
                <h3 className="mb-2 font-semibold text-violet-300">
                  Recomendações do MYRYRA Planner
                </h3>

                <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-200">
                  {recommendation}
                </p>
              </div>
            )}
          </div>

          {plan.items.length === 0 ? (
            <p className="text-slate-400">
              Nenhuma tarefa cabe no tempo disponível. Revise as prioridades ou
              aumente as horas.
            </p>
          ) : (
            <ol className="space-y-3">
              {plan.items.map((item, index) => (
                <li
                  key={item.taskId}
                  className="rounded-lg border border-slate-700 p-4"
                >
                  <p className="font-semibold">
                    {index + 1}. {item.title}
                  </p>
                  <p className="mt-1 text-sm text-slate-400">
                    Prioridade: {item.priority} · {item.estimatedMinutes} min
                  </p>
                  <p className="mt-1 text-sm text-violet-300">{item.reason}</p>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </section>
  );
}
