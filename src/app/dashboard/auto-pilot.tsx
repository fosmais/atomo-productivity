"use client";

import { useState } from "react";
import { getCloudAvailability } from "@/lib/cloud-availability";
import { getCloudTasksForScheduling } from "@/lib/cloud-task-scheduling";
import { getPlanningPreferences } from "@/lib/planning-preferences";
import { getGoogleCalendarPreferences } from "@/lib/google-calendar-preferences";
import { filterEventsBySelectedCalendars } from "@/lib/google-calendar-filter";
import { getGoogleEventInterval } from "@/lib/google-event-time";
import { calculateAvailability, type TimeInterval } from "@/lib/availability-engine";
import { suggestTaskSchedule, type SchedulingResult } from "@/lib/smart-scheduling";

type Preview = {
  result: SchedulingResult;
  missing: number;
  timeZone: string;
  calendarConnected: boolean;
};

function formatTime(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone, weekday: "short", day: "2-digit", month: "2-digit",
    hour: "2-digit", minute: "2-digit",
  }).format(date);
}

export default function AutoPilot() {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function run() {
    setBusy(true);
    setError("");
    setPreview(null);
    try {
      const [availability, tasks, preferences, calendarPreferences] = await Promise.all([
        getCloudAvailability(new Date(), 7),
        getCloudTasksForScheduling(),
        getPlanningPreferences(),
        getGoogleCalendarPreferences(),
      ]);
      const response = await fetch("/api/google/events", { cache: "no-store" });
      if (!response.ok) throw new Error("Não foi possível verificar os compromissos do Google Calendar.");
      const data: {
        connected: boolean;
        events: Array<{
          calendarId: string; start: string | null; end: string | null;
          calendarTimeZone?: string | null; status: string | null;
          transparency: string | null; selfResponseStatus: string | null;
        }>;
      } = await response.json();
      if (!Array.isArray(data.events)) throw new Error("Resposta inválida do calendário.");
      const blocked: TimeInterval[] = data.connected
        ? filterEventsBySelectedCalendars(data.events, calendarPreferences.selectedCalendarIds)
            .filter((event) =>
              event.status !== "cancelled" &&
              event.transparency !== "transparent" &&
              event.selfResponseStatus !== "declined"
            )
            .map((event) => getGoogleEventInterval(event))
            .filter((interval): interval is TimeInterval => interval !== null)
            .filter((interval) => Number.isFinite(interval.start.getTime()) &&
              Number.isFinite(interval.end.getTime()) && interval.start < interval.end)
        : [];
      const free = availability.flatMap((day) => day.available)
        .flatMap((interval) => calculateAvailability(interval, blocked).available)
        .map((interval) => ({
          start: new Date(Math.max(interval.start.getTime(), Date.now())),
          end: interval.end,
        }))
        .filter((interval) => interval.start < interval.end);
      setPreview({
        result: suggestTaskSchedule(tasks.ready, free),
        missing: tasks.missingDuration.length,
        timeZone: preferences.timeZone,
        calendarConnected: data.connected,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível gerar o planejamento.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-violet-500/30 bg-slate-900 p-5 text-white">
      <p className="text-xs font-semibold uppercase tracking-widest text-violet-400">MYRYRA · AUTOPILOT</p>
      <h3 className="mt-2 text-xl font-bold">Seu planejamento em piloto automático</h3>
      <p className="mt-2 text-sm text-slate-300">
        Simule a distribuição de tarefas pelos próximos sete dias, considerando prioridades,
        durações, disponibilidade e compromissos. Nenhum evento será criado ou alterado.
      </p>
      <button type="button" onClick={() => void run()} disabled={busy}
        className="mt-4 rounded-lg bg-violet-600 px-4 py-2 font-semibold hover:bg-violet-500 disabled:opacity-50">
        {busy ? "Calculando..." : "Gerar prévia do AutoPilot"}
      </button>
      {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
      {preview && (
        <div className="mt-5 space-y-3">
          <p className="text-sm text-slate-300">
            {preview.result.suggestions.length} encaixes · {preview.result.unscheduled.length} sem horário ·
            {" "}{preview.missing} tarefas sem duração
          </p>
          {!preview.calendarConnected && (
            <p className="text-sm text-amber-300">
              Google Calendar desconectado: os horários externos não foram considerados.
            </p>
          )}
          {preview.result.suggestions.length === 0 && (
            <p className="text-sm text-slate-400">
              Nenhum encaixe encontrado. Confira as durações e janelas de planejamento.
            </p>
          )}
          <ol className="space-y-2">
            {preview.result.suggestions.map((item) => (
              <li key={item.taskId} className="rounded-lg border border-slate-700 bg-slate-800 p-3">
                <p className="font-semibold">{item.title}</p>
                <p className="mt-1 text-sm text-violet-200">
                  {formatTime(item.start, preview.timeZone)} até {formatTime(item.end, preview.timeZone)}
                </p>
              </li>
            ))}
          </ol>
          <p className="text-xs text-slate-400">
            Prévia somente leitura. Revise os horários antes de criar compromissos.
          </p>
        </div>
      )}
    </section>
  );
}
