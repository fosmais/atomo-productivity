"use client";

import { useState } from "react";
import { saveCloudPlan } from "@/lib/plan-cloud";
import { createBrowserClient } from "@supabase/ssr";
import type { SavedTask } from "@/lib/plan-storage";

type TaskConfirmationProps = {
  task: SavedTask;
  messageId?: string;
  onSaved?: () => void;
  onCancel?: () => void;
};

export default function TaskConfirmation({
  task,
  messageId,
  onSaved,
  onCancel,
}: TaskConfirmationProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function handleConfirm() {
    if (saving || saved) return;

    setSaving(true);
    setError("");

    try {
      if (messageId) {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

        if (!url || !key) {
          throw new Error("Supabase não configurado.");
        }

        const supabase = createBrowserClient(url, key);

        const { error: confirmationError } = await supabase.rpc(
          "myka_confirm_task",
          { p_message_id: messageId }
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

      setSaved(true);
      onSaved?.();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível salvar a tarefa."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-violet-600 bg-slate-800 p-4 text-white">
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

      {saved ? (
        <p role="status" className="mt-4 text-sm text-green-400">
          Tarefa salva com sucesso!
        </p>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={saving}
            className="rounded-lg bg-violet-600 px-4 py-2 font-semibold disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Confirmar e salvar"}
          </button>

          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded-lg border border-slate-600 px-4 py-2"
          >
            Cancelar
          </button>
        </div>
      )}
    </div>
  );
}
