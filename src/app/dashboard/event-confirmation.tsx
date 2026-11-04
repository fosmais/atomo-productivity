"use client";

import { useRef, useState } from "react";
import { getGoogleEventInterval } from "@/lib/google-event-time";
import EventReminderControl from "./event-reminder-control";
import {
  saveCloudEvent,
  getCloudEvents,
  type NewCalendarEvent,
} from "@/lib/event-cloud";

type EventConfirmationProps = {
  event: NewCalendarEvent;
  messageId?: string;
  onSaved?: () => void;
  onCancel?: () => void | Promise<void>;
};

export default function EventConfirmation({
  event,
  messageId,
  onSaved,
  onCancel,
}: EventConfirmationProps) {
  const inFlight = useRef(false);
  const [saving, setSaving] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedEventId, setSavedEventId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [conflictWarning, setConflictWarning] = useState("");
  const [conflictAcknowledged, setConflictAcknowledged] = useState(false);

  async function handleConfirm() {
    if (inFlight.current || saved) return;
    inFlight.current = true;

    setSaving(true);
    setError("");

    try {
      const start = new Date(event.startsAt);
      const end = new Date(event.endsAt);
      if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) {
        throw new Error("O compromisso sugerido possui um período inválido. Peça à MIKA para corrigir os horários.");
      }
      if (start.getTime() < Date.now() - 60_000) {
        throw new Error("O horário sugerido já passou. Peça à MIKA um novo horário antes de confirmar.");
      }
      const existing = await getCloudEvents();
      const overlapping = existing.filter((savedEvent) => {
        const savedStart = new Date(savedEvent.startsAt).getTime();
        const savedEnd = new Date(savedEvent.endsAt).getTime();
        return Number.isFinite(savedStart) && Number.isFinite(savedEnd) &&
          start.getTime() < savedEnd && end.getTime() > savedStart;
      });
      let googleOverlaps: string[] = [];
      let googleUnavailable = false;
      try {
        const response = await fetch("/api/google/events", { cache: "no-store" });
        if (!response.ok) throw new Error("Consulta Google indisponível");
        const payload: {
          connected: boolean;
          events: Array<{
            title: string;
            start: string | null;
            end: string | null;
            calendarTimeZone?: string | null;
            status: string | null;
            transparency: string | null;
            selfResponseStatus: string | null;
          }>;
        } = await response.json();
        if (!Array.isArray(payload.events)) throw new Error("Resposta Google inválida");
        if (payload.connected) {
          googleOverlaps = payload.events
            .filter((item) => item.status !== "cancelled" && item.transparency !== "transparent" && item.selfResponseStatus !== "declined")
            .filter((item) => {
              const interval = getGoogleEventInterval(item);
              return interval !== null && start < interval.end && end > interval.start;
            })
            .map((item) => item.title || "Evento do Google");
        }
      } catch {
        googleUnavailable = true;
      }
      if ((overlapping.length > 0 || googleOverlaps.length > 0 || googleUnavailable) && !conflictAcknowledged) {
        const localTitles = overlapping.slice(0, 3).map(item => item.title);
        const googleTitles = googleOverlaps.slice(0, 3);
        const details = [...localTitles, ...googleTitles].join(", ");
        setConflictWarning(googleUnavailable
          ? "Não foi possível consultar o Google Calendar. Verifique sua agenda externa antes de continuar. " + (details ? "Conflitos identificados: " + details + "." : "")
          : "Este horário coincide com compromisso(s): " + details + ". Peça outro horário à MIKA ou confirme mesmo assim.");
        return;
      }
      setConflictWarning("");
      if (messageId) {
        const response = await fetch("/api/myka/proposal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messageId, acknowledgeConflict: conflictAcknowledged }) });
        if (!response.ok) {
          const data = await response.json().catch(() => null);
          if (response.status === 409 && data?.code === "EVENT_CONFLICT") {
            setConflictAcknowledged(false);
            const titles = Array.isArray(data.conflicts) ? data.conflicts.map((item: { title?: string }) => item.title).filter(Boolean).slice(0, 3).join(", ") : "";
            setConflictWarning("A agenda mudou desde a última verificação. " + (titles ? "Conflito com: " + titles + ". " : "") + "Revise e confirme novamente se desejar manter o horário.");
            return;
          }
          throw new Error(data?.error || "Falha ao confirmar compromisso.");
        }
      } else {
        await saveCloudEvent(event);
      }
      setSaved(true);
      window.dispatchEvent(new Event("myryra:events-updated"));
      onSaved?.();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Nao foi possivel salvar o evento."
      );
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }

  async function handleCancel() {
    if (inFlight.current || saved) return;
    inFlight.current = true;
    setCancelling(true);
    setError("");
    try {
      await onCancel?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível descartar a sugestão.");
    } finally {
      inFlight.current = false;
      setCancelling(false);
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

      {conflictWarning && !saved && (
        <div role="alert" className="mt-3 rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm text-amber-100">
          <p>{conflictWarning}</p>
          <label className="mt-2 flex items-center gap-2">
            <input type="checkbox" checked={conflictAcknowledged} onChange={(e) => setConflictAcknowledged(e.target.checked)} />
            Entendi o conflito e desejo continuar.
          </label>
        </div>
      )}

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
            disabled={saving || cancelling}
            className="rounded-lg bg-violet-600 px-4 py-2 font-semibold disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Confirmar evento"}
          </button>

          <button
            type="button"
            onClick={handleCancel}
            disabled={saving}
            className="rounded-lg border border-slate-600 px-4 py-2"
          >
            {cancelling ? "Descartando..." : "Cancelar"}
          </button>
        </div>
      )}
    </div>
  );
}