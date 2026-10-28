"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_PLANNING_PREFERENCES,
  getPlanningPreferences,
  savePlanningPreferences,
  type PlanningPreferences,
} from "@/lib/planning-preferences";

const days = [
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sáb" },
  { value: 0, label: "Dom" },
];

const timeZones = [
  { value: "America/Sao_Paulo", label: "São Paulo / Brasília" },
  { value: "America/Manaus", label: "Manaus" },
  { value: "America/Rio_Branco", label: "Rio Branco" },
  { value: "America/New_York", label: "Nova York" },
  { value: "Europe/Dublin", label: "Dublin" },
  { value: "Europe/Rome", label: "Roma / Milão" },
  { value: "Europe/London", label: "Londres" },
];

export default function PlanningSettings() {
  const [preferences, setPreferences] =
    useState<PlanningPreferences>({
      ...DEFAULT_PLANNING_PREFERENCES,
      weekdays: [...DEFAULT_PLANNING_PREFERENCES.weekdays],
    });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    getPlanningPreferences()
      .then((result) => {
        if (active) setPreferences(result);
      })
      .catch((err: unknown) => {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Não foi possível carregar as preferências."
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  function toggleDay(day: number) {
    setMessage("");

    setPreferences((current) => ({
      ...current,
      weekdays: current.weekdays.includes(day)
        ? current.weekdays.filter((value) => value !== day)
        : [...current.weekdays, day].sort((a, b) => a - b),
    }));
  }

  async function handleSave() {
    setSaving(true);
    setMessage("");
    setError("");

    try {
      await savePlanningPreferences(preferences);
      setMessage("Preferências salvas com sucesso!");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível salvar as preferências."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-xl border border-slate-700 bg-slate-900 p-6 text-white">
      <p className="text-sm font-semibold text-violet-400">
        MYRYRA SETTINGS
      </p>

      <h2 className="mt-1 text-2xl font-bold">
        Meu horário de planejamento
      </h2>

      <p className="mt-2 text-sm text-slate-400">
        Defina quando a VYRA poderá sugerir atividades.
      </p>

      {loading ? (
        <p className="mt-4 text-slate-400">
          Carregando preferências...
        </p>
      ) : (
        <div className="mt-5 space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm">
              <span className="block">Início</span>
              <input
                type="time"
                value={preferences.startTime}
                onChange={(event) => {
                  setMessage("");
                  setPreferences((current) => ({
                    ...current,
                    startTime: event.target.value,
                  }));
                }}
                className="w-full rounded-lg bg-slate-800 p-3"
              />
            </label>

            <label className="space-y-2 text-sm">
              <span className="block">Término</span>
              <input
                type="time"
                value={preferences.endTime}
                onChange={(event) => {
                  setMessage("");
                  setPreferences((current) => ({
                    ...current,
                    endTime: event.target.value,
                  }));
                }}
                className="w-full rounded-lg bg-slate-800 p-3"
              />
            </label>
          </div>

          <div>
            <p className="mb-3 text-sm font-medium">
              Dias de planejamento
            </p>

            <div className="flex flex-wrap gap-2">
              {days.map((day) => {
                const selected =
                  preferences.weekdays.includes(day.value);

                return (
                  <button
                    key={day.value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleDay(day.value)}
                    className={`rounded-lg border px-4 py-2 text-sm ${
                      selected
                        ? "border-violet-500 bg-violet-700 text-white"
                        : "border-slate-600 bg-slate-800 text-slate-300"
                    }`}
                  >
                    {day.label}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="block space-y-2 text-sm">
            <span className="block">Fuso horário</span>

            <select
              value={preferences.timeZone}
              onChange={(event) => {
                setMessage("");
                setPreferences((current) => ({
                  ...current,
                  timeZone: event.target.value,
                }));
              }}
              className="w-full rounded-lg bg-slate-800 p-3"
            >
              {timeZones.map((zone) => (
                <option key={zone.value} value={zone.value}>
                  {zone.label}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving || preferences.weekdays.length === 0}
            className="rounded-lg bg-violet-600 px-5 py-3 font-semibold hover:bg-violet-500 disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Salvar preferências"}
          </button>

          {message && (
            <p role="status" className="text-sm text-emerald-400">
              {message}
            </p>
          )}

          {error && (
            <p role="alert" className="text-sm text-red-400">
              {error}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
