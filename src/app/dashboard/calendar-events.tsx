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
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [calendarView, setCalendarView] = useState<"day" | "week" | "month">("week");
  const [calendarOffset, setCalendarOffset] = useState(0);
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
      window.dispatchEvent(new Event("myryra:events-updated"));

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
      window.dispatchEvent(new Event("myryra:events-updated"));
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
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date.toLocaleDateString("en-CA") : "";
  }
  function inPeriod(value: string | null) {
    const key = dateKey(value);
    if (selectedDay) return key === selectedDay;
    if (!key) return periodFilter === "all";
    if (periodFilter === "all") return true;
    if (periodFilter === "today") return key === todayKey;
    return key >= todayKey && key < weekEnd.toLocaleDateString("en-CA");
  }
  function timeLabel(value: string | null) {
    if (!value) return "—";
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return "Dia inteiro";
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—";
  }
  function dateHeading(value: string | null) {
    const key = dateKey(value);
    if (!key) return "Sem data";
    const [year, month, day] = key.split("-");
    return `${day}/${month}/${year}`;
  }
  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + index);
    const key = day.toLocaleDateString("en-CA");
    const count = events.filter((event) => dateKey(event.startsAt) === key).length +
      googleEvents.filter((event) => dateKey(event.start) === key).length;
    return { key, count, weekday: day.toLocaleDateString("pt-BR", { weekday: "short" }), day: day.getDate() };
  });
  const anchor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (calendarView === "day") anchor.setDate(anchor.getDate() + calendarOffset);
  if (calendarView === "week") anchor.setDate(anchor.getDate() - ((anchor.getDay() + 6) % 7) + calendarOffset * 7);
  if (calendarView === "month") anchor.setMonth(anchor.getMonth() + calendarOffset, 1);
  const daysCount = calendarView === "day" ? 1 : calendarView === "week" ? 7 : new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();
  const calendarDays = Array.from({ length: daysCount }, (_, i) => {
    const date = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + i);
    const key = date.toLocaleDateString("en-CA");
    const items = [
      ...events.filter((e) => dateKey(e.startsAt) === key).map((e) => ({ key: `local-${e.id}`, title: e.title, at: timeLabel(e.startsAt) })),
      ...googleEvents.filter((e) => dateKey(e.start) === key).map((e, j) => ({ key: `google-${e.id ?? j}`, title: e.title, at: timeLabel(e.start) })),
    ].sort((a, b) => a.at.localeCompare(b.at));
    return { key, date, items };
  });
  const calendarPeriod = anchor.toLocaleDateString("pt-BR", calendarView === "month" ? { month: "long", year: "numeric" } : { day: "numeric", month: "long", year: "numeric" });
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

      <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/60 p-3 sm:p-4" aria-label="Smart Calendar">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-xs font-semibold uppercase tracking-widest text-violet-300">Smart Calendar · Beta</p><h3 className="mt-1 text-lg font-semibold capitalize">{calendarPeriod}</h3></div>
          <div className="flex flex-wrap gap-2">
            {(["day", "week", "month"] as const).map((view) => <button key={view} type="button" aria-pressed={calendarView === view} onClick={() => { setCalendarView(view); setCalendarOffset(0); setSelectedDay(null); }} className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${calendarView === view ? "bg-violet-500 text-white" : "border border-white/10 text-slate-300 hover:bg-white/10"}`}>{view === "day" ? "Dia" : view === "week" ? "Semana" : "Mês"}</button>)}
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button type="button" onClick={() => setCalendarOffset((n) => n - 1)} aria-label="Período anterior" className="rounded-lg border border-white/10 px-3 py-1.5 hover:bg-white/10">‹</button>
          <button type="button" onClick={() => { setCalendarOffset(0); setSelectedDay(null); }} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs hover:bg-white/10">Hoje</button>
          <button type="button" onClick={() => setCalendarOffset((n) => n + 1)} aria-label="Próximo período" className="rounded-lg border border-white/10 px-3 py-1.5 hover:bg-white/10">›</button>
          <span className="ml-auto text-xs text-slate-400">Eventos MYRYRA + Google</span>
        </div>
        <div className={`mt-4 grid gap-2 ${calendarView === "day" ? "grid-cols-1" : calendarView === "week" ? "grid-cols-2 md:grid-cols-7" : "grid-cols-3 sm:grid-cols-5 lg:grid-cols-7"}`}>
          {calendarDays.map(({ key, date, items }) => <button key={key} type="button" onClick={() => { setSelectedDay(key); setPeriodFilter("all"); }} aria-label={`Ver eventos de ${date.toLocaleDateString("pt-BR")}`} aria-pressed={selectedDay === key} className={`min-h-24 min-w-0 rounded-xl border p-2 text-left transition hover:border-violet-400/60 ${selectedDay === key ? "border-violet-400 bg-violet-500/15" : key === todayKey ? "border-violet-500/40 bg-violet-500/10" : "border-white/10 bg-slate-900/70"}`}>
            <span className="block text-xs font-semibold capitalize text-slate-300">{date.toLocaleDateString("pt-BR", { weekday: "short" })} {date.getDate()}</span>
            <span className="mt-2 block space-y-1">{items.slice(0, calendarView === "month" ? 2 : 3).map((item) => <span key={item.key} className="block truncate rounded bg-violet-500/15 px-1.5 py-1 text-xs text-violet-100" title={item.title}>{item.at !== "Dia inteiro" ? `${item.at} · ` : ""}{item.title}</span>)}</span>
            {items.length > (calendarView === "month" ? 2 : 3) && <span className="mt-1 block text-xs text-slate-400">+{items.length - (calendarView === "month" ? 2 : 3)} eventos</span>}
          </button>)}
        </div>
        {selectedDay && <button type="button" onClick={() => setSelectedDay(null)} className="mt-3 text-xs font-medium text-violet-300 underline">Limpar filtro do dia selecionado</button>}
      </div>

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

      </div>}
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-400">
          {error}
        </p>
      )}

<section className="mt-5 rounded-xl border border-violet-500/20 bg-slate-900/60 p-3 sm:p-4" aria-label="Resumo dos próximos sete dias">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-white">Visão dos próximos 7 dias</h3>
          <span className="text-xs text-slate-400">Compromissos por dia</span>
        </div>
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {weekDays.map((day) => (
            <button key={day.key} type="button" aria-pressed={selectedDay === day.key}
              onClick={() => { setSelectedDay((current) => current === day.key ? null : day.key); setShowAllGoogle(false); setShowAllLocal(false); }}
              className={`min-w-0 rounded-lg border px-1 py-2 text-center transition focus-visible:outline-2 focus-visible:outline-violet-400 ${selectedDay === day.key ? "border-violet-400 bg-violet-600/30" : "border-slate-700 bg-slate-950/50 hover:border-violet-500/60"}`}>
              <span className="block truncate text-[10px] text-slate-400 sm:text-xs">{day.weekday}</span>
              <span className="mt-1 block text-sm font-semibold text-white">{day.day}</span>
              <span className={`mx-auto mt-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${day.count > 0 ? "bg-violet-500/25 text-violet-200" : "bg-slate-800 text-slate-500"}`}>{day.count}</span>
            </button>
          ))}
        </div>
        {selectedDay && <button type="button" onClick={() => setSelectedDay(null)} className="mt-3 text-xs font-semibold text-violet-300 underline">Limpar seleção do dia</button>}
      </section>
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
                  className="relative ml-2 min-w-0 max-w-full overflow-hidden rounded-lg border border-slate-700 border-l-2 border-l-violet-500 bg-slate-950/50 p-3"
                >
                  <details className="group">
                    <summary className="cursor-pointer list-none rounded-md py-1 focus-visible:outline-2 focus-visible:outline-violet-400">
                      <span className="flex min-w-0 items-center justify-between gap-3">
                        <span className="min-w-0 break-words font-medium"><span className="mr-2 text-xs font-semibold tabular-nums text-violet-300">{timeLabel(event.start)}</span>{event.title}</span>
                        <span className="shrink-0 text-xs text-slate-400 group-open:hidden">Detalhes +</span><span className="hidden shrink-0 text-xs text-slate-400 group-open:inline">Recolher −</span>
                      </span>
                    </summary>
                    <div className="mt-3 flex min-w-0 flex-wrap items-start justify-between gap-3 border-t border-slate-800 pt-3">
                    <div className="min-w-0 flex-1">
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
                  </details>
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
              className="relative ml-2 rounded-lg border border-slate-700 border-l-2 border-l-violet-500 bg-slate-950/50 p-3"
            >
              <details className="group">
                <summary className="cursor-pointer list-none rounded-md py-1 focus-visible:outline-2 focus-visible:outline-violet-400">
                  <span className="flex min-w-0 items-center justify-between gap-3">
                    <span className="min-w-0 break-words font-semibold"><span className="mr-2 text-xs font-semibold tabular-nums text-violet-300">{timeLabel(event.startsAt)}</span>{event.title}</span>
                    <span className="shrink-0 text-xs text-slate-400 group-open:hidden">Detalhes +</span><span className="hidden shrink-0 text-xs text-slate-400 group-open:inline">Recolher −</span>
                  </span>
                </summary>
                <div className="mt-3 flex items-start justify-between gap-3 border-t border-slate-800 pt-3">
                <div>

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
              </details>
            </div>
            </div>
          ))
        )}
        {filteredLocal.length > 5 && <button type="button" onClick={() => setShowAllLocal((value) => !value)} className="text-sm font-semibold text-violet-300 underline">{showAllLocal ? "Mostrar menos" : `Ver todos os ${filteredLocal.length} eventos`}</button>}
      </div>
    </section>
  );
}
