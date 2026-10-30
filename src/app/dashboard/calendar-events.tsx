"use client";

import { useEffect, useState } from "react";
import {
  getCloudEvents,
  saveCloudEvent,
  deleteCloudEvent,
  type CalendarEvent,
  type EventType,
} from "@/lib/event-cloud";

type GoogleCalendarEvent = {
  id: string | null;
  calendarId?: string;
  calendarName?: string;
  title: string;
  start: string | null;
  end: string | null;
  location: string | null;
  htmlLink: string | null;
};
export default function CalendarEvents() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showAllGoogle, setShowAllGoogle] = useState(false);
  const [showAllLocal, setShowAllLocal] = useState(false);
  const [periodFilter, setPeriodFilter] = useState<"today" | "week" | "all">("week");
  // VYRA_GOOGLE_CALENDAR_INTEGRATION
  const [googleEvents, setGoogleEvents] = useState<GoogleCalendarEvent[]>([]);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(true);
  const [googleError, setGoogleError] = useState("");

  async function loadGoogleEvents() {
    setGoogleLoading(true);
    setGoogleError("");

    try {
      const response = await fetch("/api/google/events", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Não foi possível consultar o Google Calendar.");
      }

      const data: {
        connected: boolean;
        events: GoogleCalendarEvent[];
      } = await response.json();

      setGoogleConnected(data.connected);
      setGoogleEvents(data.events ?? []);
    } catch {
      setGoogleError("Falha ao atualizar os compromissos do Google.");
    } finally {
      setGoogleLoading(false);
    }
  }

  useEffect(() => {
    void loadGoogleEvents();
  }, []);

  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [location, setLocation] = useState("");
  const [eventType, setEventType] = useState<EventType>("appointment");
  const [blocksTime, setBlocksTime] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function loadEvents() {
    const result = await getCloudEvents();
    setEvents(result);
  }

  useEffect(() => {
    let active = true;

    getCloudEvents()
      .then((result) => {
        if (active) setEvents(result);
      })
      .catch((err: unknown) => {
        if (active) {
          setError(
            err instanceof Error ? err.message : "Erro ao carregar eventos."
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

  async function handleSave() {
    if (!title.trim() || !startsAt || !endsAt) return;

    setSaving(true);
    setError("");

    try {
      await saveCloudEvent({
        title,
        startsAt,
        endsAt,
        location,
        eventType,
        blocksTime,
      });

      await loadEvents();

      setTitle("");
      setStartsAt("");
      setEndsAt("");
      setLocation("");
      setEventType("appointment");
      setBlocksTime(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao salvar compromisso."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Excluir este compromisso?")) return;

    setDeletingId(id);
    setError("");

    try {
      await deleteCloudEvent(id);
      await loadEvents();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao excluir compromisso."
      );
    } finally {
      setDeletingId(null);
    }
  }

  function formatDate(value: string) {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(value));
  }

  const now = new Date();
  const todayKey = now.toLocaleDateString("en-CA");
  const weekEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7);
  function dateKey(value: string | null) {
    if (!value) return "";
    if (/^\\d{4}-\\d{2}-\\d{2}$/.test(value)) return value;
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date.toLocaleDateString("en-CA") : "";
  }
  function inPeriod(value: string | null) {
    const key = dateKey(value);
    if (!key) return periodFilter === "all";
    if (periodFilter === "all") return true;
    if (periodFilter === "today") return key === todayKey;
    return key >= todayKey && key < weekEnd.toLocaleDateString("en-CA");
  }
  function dateHeading(value: string | null) {
    const key = dateKey(value);
    if (!key) return "Sem data";
    const [year, month, day] = key.split("-");
    return `${day}/${month}/${year}`;
  }
  const filteredGoogle = googleEvents.filter((event) => inPeriod(event.start))
    .sort((a, b) => (a.start ?? "").localeCompare(b.start ?? ""));
  const filteredLocal = events.filter((event) => inPeriod(event.startsAt))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const visibleGoogle = showAllGoogle ? filteredGoogle : filteredGoogle.slice(0, 5);
  const visibleLocal = showAllLocal ? filteredLocal : filteredLocal.slice(0, 5);

  return (
    <section className="rounded-2xl border border-violet-400/20 bg-gradient-to-b from-slate-900 to-slate-950 p-5 text-white shadow-xl shadow-violet-950/20 sm:p-7">
      <p className="text-sm font-semibold text-violet-400">MYRYRA CALENDAR</p>

      <h2 className="mt-1 text-2xl font-bold">Meus compromissos</h2>

      <p className="mt-2 text-sm text-slate-400">
        Cadastre seus eventos e organize seus horários.
      </p>

      <button type="button" onClick={() => setShowForm((value) => !value)}
        aria-expanded={showForm}
        className="mt-4 rounded-xl border border-violet-500/40 px-4 py-2 text-sm font-semibold text-violet-200 hover:bg-violet-500/10">
        {showForm ? "Fechar formulário" : "+ Novo compromisso"}
      </button>
      {showForm && <div className="mt-4 rounded-xl border border-slate-700 p-4">
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
        <input
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={200}
          placeholder="Nome do compromisso"
          aria-label="Nome do compromisso"
          className="min-w-0 w-full rounded-xl border border-white/10 bg-slate-800/80 p-3 text-white outline-none transition focus:border-violet-400/60 focus:ring-2 focus:ring-violet-500/20"
        />

        <input
          type="text"
          value={location}
          onChange={(event) => setLocation(event.target.value)}
          placeholder="Local ou endereço"
          aria-label="Local ou endereço"
          className="min-w-0 w-full rounded-xl border border-white/10 bg-slate-800/80 p-3 text-white outline-none transition focus:border-violet-400/60 focus:ring-2 focus:ring-violet-500/20"
        />

        <label className="min-w-0 space-y-1 text-sm">
          <span>Início</span>
          <input
            type="datetime-local"
            value={startsAt}
            onChange={(event) => setStartsAt(event.target.value)}
            className="min-w-0 w-full rounded-xl border border-white/10 bg-slate-800/80 p-3 text-white outline-none transition focus:border-violet-400/60 focus:ring-2 focus:ring-violet-500/20"
          />
        </label>

        <label className="min-w-0 space-y-1 text-sm">
          <span>Término</span>
          <input
            type="datetime-local"
            value={endsAt}
            onChange={(event) => setEndsAt(event.target.value)}
            className="min-w-0 w-full rounded-xl border border-white/10 bg-slate-800/80 p-3 text-white outline-none transition focus:border-violet-400/60 focus:ring-2 focus:ring-violet-500/20"
          />
        </label>
      </div>

      <div className="mt-4 grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="min-w-0 space-y-2 text-sm">
          <span className="block">Tipo de evento</span>

          <select
            value={eventType}
            onChange={(event) => {
              const nextType = event.target.value as EventType;
              setEventType(nextType);
              setBlocksTime(nextType === "unavailable");
            }}
            className="min-w-0 w-full rounded-xl border border-white/10 bg-slate-800/80 p-3 text-white outline-none transition focus:border-violet-400/60 focus:ring-2 focus:ring-violet-500/20"
          >
            <option value="appointment">Compromisso</option>
            <option value="unavailable">Indisponibilidade</option>
          </select>
        </label>

        <label className="flex items-center gap-3 rounded-lg border border-slate-700 p-3 text-sm">
          <input
            type="checkbox"
            checked={blocksTime}
            onChange={(event) => setBlocksTime(event.target.checked)}
            className="h-4 w-4 accent-violet-600"
          />

          Bloquear este horário na agenda
        </label>
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={saving || !title.trim() || !startsAt || !endsAt}
        className="mt-4 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-3 font-semibold text-white shadow-lg shadow-violet-900/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving ? "Salvando..." : "Adicionar compromisso"}
      </button>

      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-400">
          {error}
        </p>
      )}

{/* VYRA_GOOGLE_LAYOUT_FIX */}
      {/* Google Calendar — eventos externos somente leitura */}
      <div className="mt-6 min-w-0 max-w-full overflow-hidden rounded-xl border border-violet-500/30 bg-slate-900/50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold">Google Calendar</h3>
            <p className="text-xs text-slate-400">
              Compromissos sincronizados dos próximos 30 dias
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadGoogleEvents()}
            disabled={googleLoading}
            className="rounded-lg bg-violet-700 px-3 py-2 text-sm font-medium disabled:opacity-50"
          >
            {googleLoading ? "Atualizando..." : "Atualizar"}
          </button>
        </div>

        {googleError && (
          <p role="alert" className="mt-3 text-sm text-red-400">
            {googleError}
          </p>
        )}

        {!googleLoading && !googleConnected && !googleError && (
          <a
            href="/api/google/connect"
            className="mt-3 inline-block text-sm text-violet-300 underline"
          >
            Conectar Google Calendar
          </a>
        )}

        {!googleLoading && googleConnected && (
          <div className="mt-4 space-y-3">
            {filteredGoogle.length === 0 ? (
              <p className="text-sm text-slate-400">
                Nenhum compromisso neste período.
              </p>
            ) : (
              visibleGoogle.map((event, index) => (
                <div key={event.id ?? `google-${index}`} className="space-y-2">
                  {(index === 0 || dateKey(visibleGoogle[index - 1].start) !== dateKey(event.start)) && <h4 className="pt-2 text-xs font-semibold uppercase tracking-wider text-violet-300">{dateHeading(event.start)}</h4>}
                <div
                  className="min-w-0 max-w-full overflow-hidden rounded-lg border border-slate-700 p-3"
                >
                  <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{event.title}</p>
                      <p className="mt-1 text-xs text-violet-300">
                        Google Calendar · {event.calendarName || "Calendário principal"} · Somente leitura
                      </p>

                      {event.start && (
                        <p className="mt-1 break-words text-sm text-slate-400 [overflow-wrap:anywhere]">
                          {/^\d{4}-\d{2}-\d{2}$/.test(event.start)
                            ? `Dia inteiro: ${event.start.split("-").reverse().join("/")}`
                            : new Date(event.start).toLocaleString("pt-BR")}
                          {event.end &&
                            !/^\d{4}-\d{2}-\d{2}$/.test(event.start) &&
                            ` até ${new Date(event.end).toLocaleString("pt-BR")}`}
                        </p>
                      )}

                      {event.location && (
                        /^https?:\/\//i.test(event.location.trim()) ? (
                          <a
                            href={event.location.trim().split(/\s/)[0]}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 inline-flex items-center gap-2 rounded-lg border border-violet-500/40 bg-violet-500/10 px-3 py-2 text-sm font-medium text-violet-200 transition hover:bg-violet-500/20"
                          >
                            <span>↗</span>
                            {event.location.includes("zoom.us")
                              ? "Entrar na reunião Zoom"
                              : event.location.includes("meet.google.com")
                                ? "Entrar no Google Meet"
                                : event.location.includes("teams.microsoft.com")
                                  ? "Entrar no Microsoft Teams"
                                  : "Abrir link do evento"}
                          </a>
                        ) : (
                          <p className="mt-1 break-words text-sm text-slate-400 [overflow-wrap:anywhere]">
                            Local: {event.location}
                          </p>
                        )
                      )}
                    </div>

                    {event.htmlLink && (
                      <a
                        href={event.htmlLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 whitespace-nowrap text-xs text-violet-300 underline"
                      >
                        Abrir no Google
                      </a>
                    )}
                  </div>
                </div>
                </div>
              ))
            )}
            {filteredGoogle.length > 5 && <button type="button" onClick={() => setShowAllGoogle((value) => !value)} className="text-sm font-semibold text-violet-300 underline">{showAllGoogle ? "Mostrar menos" : `Ver todos os ${filteredGoogle.length} compromissos`}</button>}
          </div>
        )}
      </div>
      <div className="mt-6 space-y-3">
        <h3 className="font-semibold">Eventos cadastrados</h3>

        {loading ? (
          <p className="text-sm text-slate-400">Carregando eventos...</p>
        ) : filteredLocal.length === 0 ? (
          <p className="text-sm text-slate-400">
            Nenhum compromisso neste período.
          </p>
        ) : (
          visibleLocal.map((event, index) => (
            <div key={event.id} className="space-y-2">
              {(index === 0 || dateKey(visibleLocal[index - 1].startsAt) !== dateKey(event.startsAt)) && <h4 className="pt-2 text-xs font-semibold uppercase tracking-wider text-violet-300">{dateHeading(event.startsAt)}</h4>}
            <div
              className="rounded-lg border border-slate-700 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{event.title}</p>

                  <p className="mt-1 text-xs text-violet-300">
                    {event.eventType === "unavailable"
                      ? "Indisponibilidade"
                      : "Compromisso"}
                    {" · "}
                    {event.blocksTime
                      ? "Horário bloqueado"
                      : "Sem bloqueio automático"}
                  </p>

                  <p className="mt-1 text-sm text-slate-400">
                    {formatDate(event.startsAt)} até {formatDate(event.endsAt)}
                  </p>

                  {event.location && (
                    <p className="mt-1 text-sm text-slate-400">
                      Local: {event.location}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleDelete(event.id)}
                  disabled={deletingId !== null}
                  className="rounded bg-red-900 px-3 py-2 text-sm disabled:opacity-50"
                >
                  {deletingId === event.id ? "Excluindo..." : "Excluir"}
                </button>
              </div>
            </div>
            </div>
          ))
        )}
        {filteredLocal.length > 5 && <button type="button" onClick={() => setShowAllLocal((value) => !value)} className="text-sm font-semibold text-violet-300 underline">{showAllLocal ? "Mostrar menos" : `Ver todos os ${filteredLocal.length} eventos`}</button>}
      </div>
    </section>
  );
}
