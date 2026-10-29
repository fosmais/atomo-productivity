"use client";

import { useState } from "react";
import { saveCloudPlan } from "@/lib/plan-cloud";
import { createBrowserClient } from "@supabase/ssr";
import type { SavedTask } from "@/lib/plan-storage";

type TaskConfirmationProps = {
  task: SavedTask;
  messageId?: string;
  taskIndex?: number;
  onSaved?: () => void;
  onCancel?: () => void;
};

export default function TaskConfirmation({
  task,
  messageId,
  taskIndex = 0,
  onSaved,
  onCancel,
}: TaskConfirmationProps) {
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [decision, setDecision] = useState<"saved" | "cancelled" | null>(null);

  function getSupabase() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (!url || !key) {
      throw new Error("Supabase não configurado.");
    }

    return createBrowserClient(url, key);
  }

  async function handleConfirm() {
    if (working || decision) return;

    setWorking(true);
    setError("");

    try {
      if (messageId) {
        const { error: confirmationError } = await getSupabase().rpc(
          "myka_confirm_task_item",
          {
            p_message_id: messageId,
            p_task_index: taskIndex,
          }
        );

        if (confirmationError) {
          throw new Error(confirmationError.message);
        }
      } else {
        await saveCloudPlan("Tarefas do Concierge", [
          {
            title: task.title,
            priority: task.priority,
            dueDate: task.dueDate,
            completed: false,
          },
        ]);
      }

      setDecision("saved");
      onSaved?.();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível salvar a tarefa."
      );
    } finally {
      setWorking(false);
    }
  }

  async function handleCancel() {
    if (working || decision) return;

    setWorking(true);
    setError("");

    try {
      if (messageId) {
        const { error: cancellationError } = await getSupabase().rpc(
          "myka_cancel_task_item",
          {
            p_message_id: messageId,
            p_task_index: taskIndex,
          }
        );

        if (cancellationError) {
          throw new Error(cancellationError.message);
        }
      }

      setDecision("cancelled");
      onCancel?.();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível descartar a sugestão."
      );
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="rounded-xl border border-violet-600/60 bg-slate-800 p-4 text-white">
      <p className="text-xs font-bold uppercase text-violet-400">
        Nova tarefa sugerida
      </p>

      <h3 className="mt-2 text-lg font-semibold">{task.title}</h3>

      <div className="mt-3 space-y-1 text-sm text-slate-300">
        <p>Prioridade: {task.priority}</p>
        <p>Prazo: {task.dueDate ?? "Não definido"}</p>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-400">
          {error}
        </p>
      )}

      {decision === "saved" ? (
        <p role="status" className="mt-4 text-sm text-green-400">
          Tarefa salva com sucesso!
        </p>
      ) : decision === "cancelled" ? (
        <p role="status" className="mt-4 text-sm text-slate-400">
          Sugestão descartada.
        </p>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={working}
            className="rounded-lg bg-violet-600 px-4 py-2 font-semibold transition hover:bg-violet-500 disabled:opacity-50"
          >
            {working ? "Processando..." : "Confirmar e salvar"}
          </button>

          <button
            type="button"
            onClick={handleCancel}
            disabled={working}
            className="rounded-lg border border-slate-600 px-4 py-2 transition hover:bg-slate-700 disabled:opacity-50"
          >
            Descartar
          </button>
        </div>
      )}
    </div>
  );
}