"use client";

import { useEffect, useState } from "react";
import {
  getGoogleCalendarPreferences,
  saveGoogleCalendarPreferences,
} from "@/lib/google-calendar-preferences";

type GoogleCalendar = {
  id: string;
  name: string;
  primary: boolean;
  googleSelected: boolean;
  timeZone: string | null;
};

export default function GoogleCalendarSettings() {
  const [calendars, setCalendars] = useState<GoogleCalendar[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const response = await fetch("/api/google/events", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Falha ao consultar calendários Google.");
        }

        const data: {
          connected: boolean;
          calendars?: GoogleCalendar[];
        } = await response.json();

        if (!active) return;

        setConnected(data.connected);

        if (!data.connected) return;

        if (!Array.isArray(data.calendars)) {
          throw new Error("Lista de calendários indisponível.");
        }

        const preferences = await getGoogleCalendarPreferences();

        if (!active) return;

        setCalendars(data.calendars);

        setSelectedIds(
          preferences.selectedCalendarIds ??
            data.calendars
              .filter((calendar) => calendar.googleSelected)
              .map((calendar) => calendar.id)
        );
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Erro ao carregar calendários."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, []);

  function toggleCalendar(id: string) {
    setMessage("");

    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id]
    );
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      await saveGoogleCalendarPreferences(selectedIds);
      setMessage("Seleção de calendários salva com sucesso!");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível salvar os calendários."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-xl border border-slate-700 bg-slate-900 p-6 text-white">
      <p className="text-sm font-semibold text-violet-400">
        MYRYRA CALENDAR
      </p>

      <h2 className="mt-1 text-xl font-bold">
        Calendários que influenciam meu planejamento
      </h2>

      <p className="mt-2 text-sm text-slate-400">
        Escolha quais calendários Google deverão bloquear horários
        nas sugestões inteligentes da MYRYRA.
      </p>

      {loading ? (
        <p className="mt-5 text-sm text-slate-400">
          Carregando calendários...
        </p>
      ) : !connected ? (
        <p className="mt-5 text-sm text-slate-400">
          Conecte o Google Calendar para configurar seus calendários.
        </p>
      ) : (
        <div className="mt-5 space-y-4">
          {calendars.map((calendar) => (
            <label
              key={calendar.id}
              className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-slate-700 bg-slate-800 p-4"
            >
              <span>
                <span className="block font-medium">
                  {calendar.name}
                  {calendar.primary ? " (principal)" : ""}
                </span>
                <span className="block text-xs text-slate-400">
                  {calendar.timeZone ?? "Fuso não informado"}
                </span>
              </span>

              <input
                type="checkbox"
                checked={selectedIds.includes(calendar.id)}
                onChange={() => toggleCalendar(calendar.id)}
                disabled={saving}
                className="h-5 w-5 accent-violet-500"
              />
            </label>
          ))}

          <p className="text-sm text-slate-400">
            {selectedIds.length} calendário(s) selecionado(s).
          </p>

          {selectedIds.length === 0 && (
            <p className="text-sm text-amber-400">
              Atenção: nenhum calendário Google bloqueará horários
              quando essa seleção for ativada no planejamento.
            </p>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={saving || calendars.length === 0}
            className="rounded-lg bg-violet-600 px-5 py-3 font-semibold hover:bg-violet-500 disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Salvar calendários"}
          </button>
        </div>
      )}

      {message && (
        <p role="status" className="mt-4 text-sm text-emerald-400">
          {message}
        </p>
      )}

      {error && (
        <p role="alert" className="mt-4 text-sm text-red-400">
          {error}
        </p>
      )}
    </section>
  );
}
