"use client";

import { useCallback, useEffect, useState } from "react";

import { getCloudAvailability } from "@/lib/cloud-availability";
import {
  calculateAvailability,
  type TimeInterval,
} from "@/lib/availability-engine";
import {
  getCloudTasksForScheduling,
  updateTaskDuration,
} from "@/lib/cloud-task-scheduling";
import { getPlanningPreferences } from "@/lib/planning-preferences";
import { getGoogleCalendarPreferences } from "@/lib/google-calendar-preferences";
import { getGoogleEventInterval } from "@/lib/google-event-time";
import { filterEventsBySelectedCalendars } from "@/lib/google-calendar-filter";
import VyraLoading from "./vyra-loading";

import {
  suggestTaskSchedule,
  type SchedulingResult,
} from "@/lib/smart-scheduling";

type PanelData = {
  result: SchedulingResult;
  missingDuration: {
    id: string;
    title: string;
  }[];
  timeZone: string;
};

function formatDateTime(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export default function SmartSchedulingPanel() {
  const [data, setData] = useState<PanelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [durations, setDurations] = useState<Record<string, number>>({});
  const [savingTaskId, setSavingTaskId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState("");

  const loadSuggestions = useCallback(async () => {
    setLoading(true);
    setError("");
    setData(null);

    try {
      const [availability, tasks, preferences] =
        await Promise.all([
          getCloudAvailability(new Date(), 7),
          getCloudTasksForScheduling(),
          getPlanningPreferences(),
        ]);

      const availableIntervals = availability.flatMap(
        (day) => day.available
      );

      const googleResponse = await fetch("/api/google/events", {
        cache: "no-store",
      });

      if (!googleResponse.ok) {
        throw new Error(
          "Não foi possível consultar o Google Calendar."
        );
      }

      const googleData: {
        connected: boolean;
        events: Array<{ calendarId: string;
          start: string | null;
          end: string | null;
          calendarTimeZone?: string | null;
          status: string | null;
          transparency: string | null;
          selfResponseStatus: string | null;
        }>;
      } = await googleResponse.json();

      if (!Array.isArray(googleData.events)) {
        throw new Error("Resposta inválida do Google Calendar.");
      }

      const calendarPreferences = await getGoogleCalendarPreferences();

      const selectedCalendarIds = calendarPreferences.selectedCalendarIds;

      const googleBlocked: TimeInterval[] = googleData.connected
        ? filterEventsBySelectedCalendars(
            googleData.events,
            selectedCalendarIds
          )
            .filter(
              (event) =>
                event.status !== "cancelled" &&
                event.transparency !== "transparent" &&
                event.selfResponseStatus !== "declined"
            )
            .map((event) => getGoogleEventInterval(event))
            .filter(
              (interval): interval is TimeInterval =>
                interval !== null
            )
            .filter(
              (interval) =>
                Number.isFinite(interval.start.getTime()) &&
                Number.isFinite(interval.end.getTime()) &&
                interval.start < interval.end
            )
        : [];

      const freeIntervals = availableIntervals.flatMap(
        (interval) =>
          calculateAvailability(interval, googleBlocked).available
      );

      const result = suggestTaskSchedule(
        tasks.ready,
        freeIntervals
      );

      setData({
        result,
        missingDuration: tasks.missingDuration.map(
          (task) => ({
            id: task.id,
            title: task.title,
          })
        ),
        timeZone: preferences.timeZone,
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível calcular as sugestões."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  async function saveDuration(taskId: string) {
    const minutes = durations[taskId];

    setSaveError("");
    setSavingTaskId(taskId);

    try {
      await updateTaskDuration(taskId, minutes);
      await loadSuggestions();
    } catch (err) {
      setSaveError(
        err instanceof Error
          ? err.message
          : "Não foi possível salvar a duração."
      );
    } finally {
      setSavingTaskId(null);
    }
  }

  useEffect(() => {
    void loadSuggestions();
  }, [loadSuggestions]);

  return (
    <section className="rounded-xl border border-slate-700 bg-slate-900 p-6 text-white">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-violet-400">
            MYRYRA SMART SCHEDULING
          </p>

          <h2 className="mt-1 text-2xl font-bold">
            Sugestões inteligentes
          </h2>

          <p className="mt-2 text-sm text-slate-400">
            Planejamento baseado em prioridade,
            duração e disponibilidade.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadSuggestions()}
          disabled={loading}
          className="rounded-lg border border-violet-500 px-4 py-2 text-sm text-violet-200 hover:bg-violet-900 disabled:opacity-50"
        >
          {loading ? "Calculando..." : "Atualizar"}
        </button>
      </div>

      {loading && (
        <div className="mt-5">
          <VyraLoading
            message="Analisando tarefas, prioridades e horários disponíveis..."
          />
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="mt-5 rounded-xl border border-red-500/20 bg-red-500/5 p-5"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-xl text-red-400">
              !
            </div>

            <div className="min-w-0 flex-1">
              <p className="font-semibold text-white">
                Não foi possível preparar seu planejamento.
              </p>

              <p className="mt-2 text-sm text-slate-400">
                {error}
              </p>

              <button
                type="button"
                onClick={() => void loadSuggestions()}
                disabled={loading}
                className="mt-4 rounded-lg border border-violet-500/40 bg-violet-500/10 px-4 py-2 text-sm font-medium text-violet-200 transition-colors hover:bg-violet-500/20 disabled:opacity-50"
              >
                {loading ? "Tentando novamente..." : "Tentar novamente"}
              </button>
            </div>
          </div>
        </div>
      )}

      {!loading && !error && data && (
        <div className="mt-5 space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-slate-800 p-4">
              <p className="text-xs text-slate-400">
                Sugestões
              </p>
              <p className="mt-1 text-2xl font-bold">
                {data.result.suggestions.length}
              </p>
            </div>

            <div className="rounded-lg bg-slate-800 p-4">
              <p className="text-xs text-slate-400">
                Sem duração
              </p>
              <p className="mt-1 text-2xl font-bold">
                {data.missingDuration.length}
              </p>
            </div>

            <div className="rounded-lg bg-slate-800 p-4">
              <p className="text-xs text-slate-400">
                Sem encaixe
              </p>
              <p className="mt-1 text-2xl font-bold">
                {data.result.unscheduled.length}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold">
              Horários sugeridos
            </h3>

            {data.result.suggestions.length === 0 ? (
              <p className="text-sm text-slate-400">
                Nenhuma sugestão disponível.
                Verifique as durações das tarefas
                e os horários de planejamento.
              </p>
            ) : (
              data.result.suggestions.map((item) => (
                <div
                  key={item.taskId}
                  className="rounded-lg border border-violet-800 bg-violet-950/40 p-4"
                >
                  <p className="font-semibold">
                    {item.title}
                  </p>

                  <p className="mt-2 text-sm text-violet-200">
                    {formatDateTime(
                      item.start,
                      data.timeZone
                    )}
                    {" até "}
                    {formatDateTime(
                      item.end,
                      data.timeZone
                    )}
                  </p>

                  <p className="mt-1 text-xs text-slate-400">
                    Prioridade: {item.priority}
                  </p>
                </div>
              ))
            )}
          </div>

          {saveError && (
            <p role="alert" className="text-sm text-red-400">
              {saveError}
            </p>
          )}

          {data.missingDuration.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold text-amber-300">
                Tarefas que precisam de duração
              </h3>

              {data.missingDuration.map((task) => (
                <div
                  key={task.id}
                  className="rounded-lg bg-slate-800 p-4"
                >
                  <p className="mb-3 text-sm font-medium">
                    {task.title}
                  </p>

                  <div className="flex flex-wrap items-center gap-3">
                    <select
                      aria-label={`Duração de ${task.title}`}
                      value={durations[task.id] ?? ""}
                      onChange={(event) =>
                        setDurations((current) => ({
                          ...current,
                          [task.id]: Number(event.target.value),
                        }))
                      }
                      className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white"
                    >
                      <option value="" disabled>
                        Selecione a duração
                      </option>
                      <option value="15">15 minutos</option>
                      <option value="30">30 minutos</option>
                      <option value="45">45 minutos</option>
                      <option value="60">1 hora</option>
                      <option value="90">1h30</option>
                      <option value="120">2 horas</option>
                      <option value="180">3 horas</option>
                      <option value="240">4 horas</option>
                    </select>

                    <button
                      type="button"
                      disabled={
                        savingTaskId !== null ||
                        !durations[task.id]
                      }
                      onClick={() => void saveDuration(task.id)}
                      className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {savingTaskId === task.id
                        ? "Salvando..."
                        : "Salvar duração"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {data.result.unscheduled.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold text-amber-300">
                Tarefas sem horário suficiente
              </h3>

              {data.result.unscheduled.map((task) => (
                <p
                  key={task.id}
                  className="rounded-lg bg-slate-800 p-3 text-sm"
                >
                  {task.title}
                </p>
              ))}
            </div>
          )}

          <p className="text-xs text-slate-400">
            As sugestões são provisórias.
            Nenhuma tarefa foi agendada ou alterada.
          </p>
        </div>
      )}
    </section>
  );
}
