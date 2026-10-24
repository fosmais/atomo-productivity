
"use client";

import { useEffect, useState } from "react";
import {
  getCloudPlans,
  saveCloudPlan,
  deleteCloudPlan,
  updateCloudTaskStatus,
} from "@/lib/plan-cloud";
import type { SavedPlan } from "@/lib/plan-storage";

export default function CloudPlans() {
  const [plans, setPlans] = useState<SavedPlan[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function loadPlans() {
    setLoading(true);
    setError("");

    try {
      const data = await getCloudPlans();
      setPlans(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao carregar planos."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPlans();
  }, []);

  async function handleSave() {
    if (!name.trim()) return;

    setSaving(true);
    setError("");

    try {
      await saveCloudPlan(name.trim(), []);
      setName("");
      await loadPlans();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao salvar plano."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Deseja excluir este plano?")) return;

    setError("");

    try {
      await deleteCloudPlan(id);
      await loadPlans();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao excluir plano."
      );
    }
  }

  async function handleToggleTask(taskId: string, completed: boolean) {
    setError("");

    try {
      await updateCloudTaskStatus(taskId, completed);
      await loadPlans();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível atualizar a tarefa."
      );
    }
  }

  return (
    <section className="rounded-xl border border-slate-800 p-6">
      <h2 className="text-xl font-semibold">Meus planos na nuvem</h2>

      <div className="mt-4 flex flex-wrap gap-2">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Nome do novo plano"
          className="min-w-0 flex-1 rounded bg-slate-800 p-3 text-white"
        />

        <button
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="rounded bg-teal-600 px-4 py-3 font-semibold disabled:opacity-50"
        >
          {saving ? "Salvando..." : "Criar plano"}
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-4 text-red-400">
          {error}
        </p>
      )}

      {loading ? (
        <p className="mt-4 text-slate-400">Carregando planos...</p>
      ) : plans.length === 0 ? (
        <p className="mt-4 text-slate-400">
          Você ainda não possui planos na nuvem.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {plans.map((plan) => (
            <li
              key={plan.id}
              className="flex items-center justify-between gap-3 rounded bg-slate-900 p-4"
            >
              <div>
                <p className="font-medium">{plan.name}</p>
                <p className="text-sm text-slate-400">
                  {plan.tasks.length} tarefas
                </p>
                <ul className="mt-3 space-y-2">
                  {plan.tasks.map((task) => (
                    <li key={task.id} className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={task.completed}
                        onChange={(event) => {
                          if (!task.id) {
                            setError(
                              "Esta tarefa não possui um identificador válido."
                            );
                            return;
                          }

                          void handleToggleTask(task.id, event.target.checked);
                        }}
                        className="h-4 w-4 accent-teal-500"
                      />

                      <span
                        className={
                          task.completed
                            ? "text-slate-500 line-through"
                            : "text-slate-200"
                        }
                      >
                        {task.title}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                onClick={() => handleDelete(plan.id)}
                className="text-red-400 hover:text-red-300"
              >
                Excluir
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
