
"use client";

import { useEffect, useState } from "react";
import {
  getCloudPlans,
  saveCloudPlan,
  deleteCloudPlan,
  addCloudTask,
} from "@/lib/plan-cloud";
import type { SavedPlan } from "@/lib/plan-storage";

export default function CloudPlans() {
  const [plans, setPlans] = useState<SavedPlan[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [newTaskTitles, setNewTaskTitles] = useState<Record<string, string>>({});
  const [newTaskPriorities, setNewTaskPriorities] = useState<
    Record<string, "Alta" | "Média" | "Normal">
  >({});
  const [addingTaskId, setAddingTaskId] = useState<string | null>(null);

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
                <div className="mt-3 flex flex-wrap gap-2">
                  <input
                    type="text"
                    value={newTaskTitles[plan.id] ?? ""}
                    onChange={(event) =>
                      setNewTaskTitles((previous) => ({
                        ...previous,
                        [plan.id]: event.target.value,
                      }))
                    }
                    maxLength={200}
                    placeholder="Nome da nova tarefa"
                    className="min-w-0 flex-1 rounded bg-slate-800 p-2 text-white"
                  />

                  <select
                    value={newTaskPriorities[plan.id] ?? "Normal"}
                    onChange={(event) =>
                      setNewTaskPriorities((previous) => ({
                        ...previous,
                        [plan.id]: event.target.value as
                          | "Alta"
                          | "Média"
                          | "Normal",
                      }))
                    }
                    className="rounded bg-slate-800 p-2 text-white"
                  >
                    <option value="Normal">Normal</option>
                    <option value="Média">Média</option>
                    <option value="Alta">Alta</option>
                  </select>

                  <button
                    type="button"
                    disabled={
                      addingTaskId !== null ||
                      !(newTaskTitles[plan.id] ?? "").trim()
                    }
                    onClick={async () => {
                      const title = (newTaskTitles[plan.id] ?? "").trim();
                      if (!title) return;

                      setAddingTaskId(plan.id);
                      setError("");

                      try {
                        await addCloudTask(
                          plan.id,
                          title,
                          newTaskPriorities[plan.id] ?? "Normal"
                        );

                        await loadPlans();

                        setNewTaskTitles((previous) => ({
                          ...previous,
                          [plan.id]: "",
                        }));
                      } catch (err) {
                        setError(
                          err instanceof Error
                            ? err.message
                            : "Erro ao adicionar tarefa."
                        );
                      } finally {
                        setAddingTaskId(null);
                      }
                    }}
                    className="rounded bg-teal-600 px-3 py-2 font-semibold text-white disabled:opacity-50"
                  >
                    {addingTaskId === plan.id
                      ? "Adicionando..."
                      : "Adicionar tarefa"}
                  </button>
                </div>
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
