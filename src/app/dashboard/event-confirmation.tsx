"use client";

import { useState } from "react";
import {
  saveCloudEvent,
  type NewCalendarEvent,
} from "@/lib/event-cloud";

type EventConfirmationProps = {
  event: NewCalendarEvent;
  onSaved?: () => void;
  onCancel?: () => void;
};

export default function EventConfirmation({
  event,
  onSaved,
  onCancel,
}: EventConfirmationProps) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function handleConfirm() {
    if (saving || saved) return;

    setSaving(true);
    setError("");

    try {
      await saveCloudEvent(event);
      setSaved(true);
      onSaved?.();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Nao foi possivel salvar o evento."
      );
    } finally {
      setSaving(false);
    }
  }

  function formatDate(value: string) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "Data invalida";
    }

    return date.toLocaleString("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    });
  }

  return (
    <div className="rounded-xl border border-violet-600 bg-slate-800 p-4 text-white">
      <p className="text-xs font-bold uppercase text-violet-400">
        Novo evento sugerido
      </p>

      <h3 className="mt-2 text-lg font-semibold">
        {event.title}
      </h3>

      <div className="mt-3 space-y-1 text-sm text-slate-300">
        <p>Inicio: {formatDate(event.startsAt)}</p>
        <p>Fim: {formatDate(event.endsAt)}</p>

        <p>
          Tipo:{" "}
          {event.eventType === "unavailable"
            ? "Indisponibilidade"
            : "Compromisso"}
        </p>

        <p>
          Bloqueia horario:{" "}
          {event.blocksTime ? "Sim" : "Nao"}
        </p>

        {event.location && (
          <p>Local: {event.location}</p>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-400">
          {error}
        </p>
      )}

      {saved ? (
        <p role="status" className="mt-4 text-sm text-green-400">
          Evento salvo com sucesso!
        </p>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={saving}
            className="rounded-lg bg-violet-600 px-4 py-2 font-semibold disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Confirmar evento"}
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