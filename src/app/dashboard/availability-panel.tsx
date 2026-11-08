"use client";

import { useCallback, useEffect, useState } from "react";

import {
  getCloudAvailability,
  type DailyAvailability,
} from "@/lib/cloud-availability";

import { getPlanningPreferences } from "@/lib/planning-preferences";
import { calculateAvailability, type TimeInterval } from "@/lib/availability-engine";
import { getGoogleCalendarPreferences } from "@/lib/google-calendar-preferences";
import { filterEventsBySelectedCalendars } from "@/lib/google-calendar-filter";
import { getGoogleEventInterval } from "@/lib/google-event-time";

type ViewState = {
  days: DailyAvailability[];
  timeZone: string;
  googleWarning: string;
};

function formatTime(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function formatDay(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    weekday: "long",
    day: "2-digit",
    month: "short",
  }).format(date);
}

export default function AvailabilityPanel() {
  const [view, setView] = useState<ViewState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadAvailability = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const preferences = await getPlanningPreferences();
      const days = await getCloudAvailability(new Date(), 7);
      let googleWarning = "";
      let mergedDays = days;
      try {
        const response = await fetch("/api/google/events", { cache: "no-store" });
        if (!response.ok) throw new Error("Consulta Google indisponível");
        const payload: {
          connected: boolean;
          events: Array<{
            calendarId: string;
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
          const selected = (await getGoogleCalendarPreferences()).selectedCalendarIds;
          const blocked: TimeInterval[] = filterEventsBySelectedCalendars(payload.events, selected)
            .filter(e => e.status !== "cancelled" && e.transparency !== "transparent" && e.selfResponseStatus !== "declined")
            .map(e => getGoogleEventInterval(e))
            .filter((e): e is TimeInterval => e !== null);
          mergedDays = days.map(day => {
            const result = calculateAvailability(day.window, [...day.blocked, ...blocked]);
            return { window: day.window, available: result.available, blocked: result.blocked };
          });
        }
      } catch {
        googleWarning = "Google Calendar não foi consultado. A disponibilidade abaixo considera somente os compromissos da MYRYRA.";
      }
      setView({
        days: mergedDays,
        timeZone: preferences.timeZone,
        googleWarning,
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível consultar a disponibilidade."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active) void loadAvailability(); });
    const refresh = () => { void loadAvailability(); };
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("myryra:events-updated", refresh);
    window.addEventListener("myryra:tasks-updated", refresh);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      active = false;
      window.removeEventListener("myryra:events-updated", refresh);
      window.removeEventListener("myryra:tasks-updated", refresh);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [loadAvailability]);

  return (
    <section className="rounded-xl border border-slate-700 bg-slate-900 p-6 text-white">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-violet-400">
            MYRYRA AVAILABILITY
          </p>

          <h2 className="mt-1 text-2xl font-bold">
            Minha disponibilidade
          </h2>

          <p className="mt-2 text-sm text-slate-400">
            Próximos 7 dias no seu fuso de planejamento.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadAvailability()}
          disabled={loading}
          className="rounded-lg border border-violet-500 px-4 py-2 text-sm text-violet-200 hover:bg-violet-900 disabled:opacity-50"
        >
          Atualizar
        </button>
      </div>

      {loading && (
        <p className="mt-5 text-sm text-slate-400">
          Calculando disponibilidade...
        </p>
      )}

      {error && (
        <p role="alert" className="mt-5 text-sm text-red-400">
          {error}
        </p>
      )}

      {!loading && !error && view && (
        <div className="mt-5 space-y-4">
          <p className="text-xs text-slate-400">
            Fuso: {view.timeZone}
          </p>
          {view.googleWarning && <p role="status" className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">{view.googleWarning}</p>}

          {view.days.length === 0 ? (
            <p className="text-sm text-slate-300">
              Nenhuma janela de planejamento restante
              no período consultado.
            </p>
          ) : (
            view.days.map((day) => (
              <div
                key={day.window.start.toISOString()}
                className="rounded-lg border border-slate-700 bg-slate-800 p-4"
              >
                <h3 className="mb-3 font-semibold capitalize">
                  {formatDay(day.window.start, view.timeZone)}
                </h3>

                <p className="mb-3 text-xs text-slate-400">
                  Janela:{" "}
                  {formatTime(day.window.start, view.timeZone)}
                  {" às "}
                  {formatTime(day.window.end, view.timeZone)}
                </p>

                <div className="space-y-2">
                  {[
                    ...day.available.map((interval) => ({
                      ...interval,
                      blocked: false,
                    })),
                    ...day.blocked.map((interval) => ({
                      ...interval,
                      blocked: true,
                    })),
                  ]
                    .sort(
                      (a, b) =>
                        a.start.getTime() - b.start.getTime()
                    )
                    .map((interval) => (
                      <div
                        key={`${interval.start.toISOString()}-${interval.blocked}`}
                        className={`rounded-lg px-3 py-2 text-sm ${
                          interval.blocked
                            ? "bg-red-950 text-red-200"
                            : "bg-violet-900/60 text-violet-100"
                        }`}
                      >
                        {formatTime(interval.start, view.timeZone)}
                        {" – "}
                        {formatTime(interval.end, view.timeZone)}
                        {" · "}
                        {interval.blocked
                          ? "Bloqueado"
                          : "Potencialmente disponível"}
                      </div>
                    ))}
                </div>
              </div>
            ))
          )}

          <p className="text-xs text-slate-400">
            Horários sem bloqueio são potencialmente disponíveis. Compromissos locais e eventos ocupados dos calendários Google selecionados são considerados quando a integração está disponível. Tarefas com apenas prazo de entrega não bloqueiam horários.
          </p>
        </div>
      )}
    </section>
  );
}
