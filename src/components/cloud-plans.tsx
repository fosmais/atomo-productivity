"use client";

import { useEffect, useState } from "react";
import { getCloudPlans } from "@/lib/plan-cloud";
import type { SavedPlan } from "@/lib/plan-storage";

export default function CloudPlans() {
  const [plans, setPlans] = useState<SavedPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadPlans() {
      try {
        const data = await getCloudPlans();

        if (active) {
          setPlans(data);
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error ? err.message : "Erro ao carregar os planos."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadPlans();

    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return <p className="text-slate-400">Carregando planos...</p>;
  }

  if (error) {
    return <p role="alert" className="text-red-400">{error}</p>;
  }

  if (plans.length === 0) {
    return (
      <p className="text-slate-400">
        Você ainda não possui planos salvos na nuvem.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {plans.map((plan) => (
        <article
          key={plan.id}
          className="rounded-lg border border-slate-700 p-4"
        >
          <h3 className="font-semibold">{plan.name}</h3>

          <p className="mt-1 text-sm text-slate-400">
            {plan.tasks.length} tarefa(s)
          </p>

          <ul className="mt-3 space-y-2">
            {plan.tasks.map((task, index) => (
              <li
                key={`${plan.id}-${index}`}
                className="text-sm text-slate-300"
              >
                {task.completed ? "✓" : "○"} {task.title}
              </li>
            ))}
          </ul>
        </article>
      ))}
    </div>
  );
}
