"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useVyraNavigation } from "./vyra-module-context";
import EventReminderControl from "./event-reminder-control";
import { EVENT_CATEGORIES, suggestEventCategory, type EventCategory } from "@/lib/event-categories";
import {
  getCloudEvents,
  saveCloudEvent,
  deleteCloudEvent,
  renameCloudEvent,
  updateCloudEventCategory,
  type CalendarEvent,
  type EventType,
} from "@/lib/event-cloud";

type CalendarTask = { id: string; title: string; due_date: string | null; completed: boolean; priority: string };

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
  const { navigateTo } = useVyraNavigation();
  function planWithMyka(event: CalendarEvent) {
    if (!event.concierge) return;
    const services = event.concierge.services.map(service => ({ transport: "transporte", parking: "estacionamento", restaurant: "restaurante", hotel: "hospedagem" }[service] || service)).join(", ") || "orientações gerais";
    const prompt = `Ajude-me a planejar a logística deste compromisso já cadastrado na MYRYRA. Título: ${event.title}. Início: ${event.startsAt}. Término: ${event.endsAt}. Destino: ${event.location || "não informado"}. Partida: ${event.concierge.departureAddress || "pergunte meu ponto de partida"}. Preciso de: ${services}. Sugira uma antecedência de saída e opções para cada serviço. Antes de estimar deslocamento, peça os dados que faltarem; não invente trânsito, preços, disponibilidade ou reservas. Não efetue compras ou reservas sem minha confirmação.`;
    try {
      sessionStorage.setItem("myryra:myka:concierge-handoff", prompt.slice(0, 3500));
      navigateTo("vyra-ai");
    } catch {
      setError("Não foi possível abrir a MIKA agora. Tente novamente.");
    }
  }
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [favoriteEventIds, setFavoriteEventIds] = useState<string[]>([]);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<EventCategory | "all">("all");
  const [favoriteBusyId, setFavoriteBusyId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<CalendarTask[]>([]);
  const [tasksError, setTasksError] = useState("");
  useEffect(() => {
    let active = true;
    async function loadCalendarTasks() {
      try {
        const supabase = createClient();
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (authError || !auth.user) throw new Error("Faça login para visualizar tarefas.");
        const { data, error } = await supabase.from("tasks")
          .select("id, title, due_date, completed, priority")
          .eq("user_id", auth.user.id)
          .not("due_date", "is", null)
          .order("due_date", { ascending: true })
          .limit(500);
        if (error) throw error;
        if (active) { setTasks((data ?? []) as CalendarTask[]); setTasksError(""); }
      } catch {
        if (active) setTasksError("Não foi possível carregar as tarefas no calendário.");
      }
    }
    void loadCalendarTasks();
    window.addEventListener("myryra:tasks-updated", loadCalendarTasks);
    return () => { active = false; window.removeEventListener("myryra:tasks-updated", loadCalendarTasks); };
  }, []);
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
  const [googleReconnectRequired, setGoogleReconnectRequired] = useState(false);

  async function loadGoogleEvents() {
    setGoogleLoading(true);
    setGoogleError("");
    setGoogleReconnectRequired(false);

    try {
      const response = await fetch("/api/google/events", {
        cache: "no-store",
      });

      if (response.status === 409) {
        const detail: { code?: string } = await response.json();
        if (detail.code === "GOOGLE_CALENDAR_RECONNECT_REQUIRED") {
          setGoogleConnected(false);
          setGoogleEvents([]);
          setGoogleReconnectRequired(true);
          setGoogleError("Sua conexão Google Calendar precisa ser renovada.");
          return;
        }
      }
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
  const [category, setCategory] = useState<EventCategory>("personal");
  const [categoryChosen, setCategoryChosen] = useState(false);
  const [blocksTime, setBlocksTime] = useState(false);
  const [conciergeEnabled, setConciergeEnabled] = useState(false);
  const [departureAddress, setDepartureAddress] = useState("");
  const [conciergeServices, setConciergeServices] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [categoryBusyId, setCategoryBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function loadEvents() {
    const result = await getCloudEvents();
    setEvents(result);
    await loadFavoriteEvents();
  }

  async function loadFavoriteEvents() {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Sessão expirada.");
    const { data, error: favoritesError } = await supabase.from("favorites")
      .select("event_id").eq("user_id", user.id).not("event_id", "is", null);
    if (favoritesError) throw favoritesError;
    setFavoriteEventIds((data ?? []).flatMap((row) => row.event_id ? [row.event_id as string] : []));
  }

  async function toggleFavoriteEvent(event: CalendarEvent) {
    if (favoriteBusyId) return;
    setFavoriteBusyId(event.id);
    setError("");
    try {
      const supabase = createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error("Sessão expirada.");
      if (favoriteEventIds.includes(event.id)) {
        const { error } = await supabase.from("favorites").delete()
          .eq("user_id", user.id).eq("event_id", event.id);
        if (error) throw error;
        setFavoriteEventIds((ids) => ids.filter((id) => id !== event.id));
      } else {
        const { error } = await supabase.from("favorites").insert({
          user_id: user.id, event_id: event.id, task_id: null
        });
        if (error) throw error;
        setFavoriteEventIds((ids) => [...ids, event.id]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível atualizar o favorito.");
    } finally { setFavoriteBusyId(null); }
  }

  useEffect(() => {
    // MYKA and other dashboard modules can save an event independently.
    // Refresh when they notify us or when the user returns to this tab.
    let lastRefresh = 0;
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastRefresh < 2000) return;
      lastRefresh = now;
      void loadEvents().then(() => setError("")).catch(() =>
        setError("Não foi possível atualizar os compromissos.")
      );
      void loadGoogleEvents();
    };
    window.addEventListener("myryra:events-updated", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("myryra:events-updated", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  useEffect(() => {
    let active = true;

    getCloudEvents()
      .then((result) => {
        if (active) { setEvents(result); void loadFavoriteEvents().catch(() => {}); }
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
    if (!title.trim() || !startsAt || !endsAt) {
      setError("Preencha o título, o início e o término do compromisso.");
      return;
    }
    const startMs = new Date(startsAt).getTime();
    const endMs = new Date(endsAt).getTime();
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
      setError("O término deve ser posterior ao início do compromisso.");
      return;
    }

    if (startMs < Date.now() - 60_000) {
      setError("Não é possível agendar um novo compromisso no passado. Escolha uma data e horário futuros.");
      return;
    }

    if (conciergeEnabled && eventType === "appointment" && !location.trim()) {
      setError("Informe o endereço do destino para ativar o Concierge.");
      return;
    }
    setSaving(true);
    setError("");

    try {
      await saveCloudEvent({
        title,
        startsAt,
        endsAt,
        location,
        eventType,
        category,
        blocksTime,
        concierge: conciergeEnabled && eventType === "appointment" ? {
          departureAddress: departureAddress.trim(),
          services: conciergeServices,
        } : undefined,
      });

      await loadEvents();
      window.dispatchEvent(new Event("myryra:events-updated"));
      setSelectedDay(null);

      setTitle("");
      setStartsAt("");
      setEndsAt("");
      setLocation("");
      setEventType("appointment");
      setCategory("personal");
      setCategoryChosen(false);
      setBlocksTime(false);
      setConciergeEnabled(false);
      setDepartureAddress("");
      setConciergeServices([]);
      setShowForm(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao salvar compromisso."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleRename() {
    if (!editingId || renaming) return;
    setRenaming(true);
    setError("");
    try {
      await renameCloudEvent(editingId, editingTitle);
      await loadEvents();
      window.dispatchEvent(new Event("myryra:events-updated"));
      setEditingId(null);
      setEditingTitle("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível renomear o compromisso.");
    } finally {
      setRenaming(false);
    }
  }

  async function handleCategoryChange(eventId: string, nextCategory: EventCategory) {
    if (categoryBusyId) return;
    setCategoryBusyId(eventId);
    setError("");
    try {
      await updateCloudEventCategory(eventId, nextCategory);
      setEvents((previous) => previous.map((event) => event.id === eventId ? { ...event, category: nextCategory } : event));
      window.dispatchEvent(new Event("myryra:events-updated"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível atualizar a categoria.");
    } finally {
      setCategoryBusyId(null);
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
  const anchor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (calendarView === "day") anchor.setDate(anchor.getDate() + calendarOffset);
  if (calendarView === "week") anchor.setDate(anchor.getDate() - ((anchor.getDay() + 6) % 7) + calendarOffset * 7);
  if (calendarView === "month") {
    anchor.setDate(1);
    anchor.setMonth(anchor.getMonth() + calendarOffset);
  }
  const daysCount = calendarView === "day" ? 1 : calendarView === "week" ? 7 : new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();
  const calendarDays = Array.from({ length: daysCount }, (_, i) => {
    const date = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + i);
    const key = date.toLocaleDateString("en-CA");
    const items = [
      ...events.filter((e) => dateKey(e.startsAt) === key && (categoryFilter === "all" || e.category === categoryFilter)).map((e) => ({ key: `local-${e.id}`, title: e.title, at: timeLabel(e.startsAt), color: EVENT_CATEGORIES[e.category].color })),
      ...googleEvents.filter((e) => dateKey(e.start) === key).map((e, j) => ({ key: `google-${e.id ?? j}`, title: e.title, at: timeLabel(e.start), color: "#64748B" })),
      ...tasks.filter((t) => dateKey(t.due_date) === key).map((t) => ({ key: `task-${t.id}`, title: `${t.completed ? "✓ " : "□ "}${t.title}`, at: "Tarefa", color: "#64748B" })),
    ].sort((a, b) => a.at.localeCompare(b.at));
    return { key, date, items };
  });
  const calendarPeriod = anchor.toLocaleDateString("pt-BR", calendarView === "month" ? { month: "long", year: "numeric" } : { day: "numeric", month: "long", year: "numeric" });
  function suggestFreeHours(key: string): number[] {
    const busy = [
      ...events.filter((event) => event.blocksTime && dateKey(event.startsAt) === key).map((event) => ({ start: event.startsAt, end: event.endsAt })),
      ...googleEvents.filter((event) => dateKey(event.start) === key).map((event) => ({ start: event.start, end: event.end })),
    ].filter((event) => event.start && event.end);
    return [9, 10, 11, 13, 14, 15, 16, 17].filter((hour) => {
      const slotStart = new Date(`${key}T${String(hour).padStart(2, "0")}:00:00`).getTime();
      const slotEnd = slotStart + 60 * 60 * 1000;
      return busy.every((event) => {
        const start = new Date(event.start!).getTime();
        const end = new Date(event.end!).getTime();
        return !Number.isFinite(start) || !Number.isFinite(end) || slotEnd <= start || slotStart >= end;
      });
    });
  }
  function startEventAtHour(key: string, hour: number) {
    const localValue = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}T${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
    const start = new Date(`${key}T${String(hour).padStart(2, "0")}:00:00`);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    setStartsAt(localValue(start));
    setEndsAt(localValue(end));
    setSelectedDay(key);
    setShowForm(true);
    window.requestAnimationFrame(() => document.getElementById("myryra-calendar-event-form")?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }
  function startEventOnDay(key: string) {
    const day = new Date(`${key}T09:00:00`);
    if (Number.isNaN(day.getTime())) return;
    const end = new Date(day.getTime() + 60 * 60 * 1000);
    const localValue = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}T${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
    setStartsAt(localValue(day));
    setEndsAt(localValue(end));
    setShowForm(true);
    setSelectedDay(key);
    window.requestAnimationFrame(() => document.getElementById("myryra-calendar-event-form")?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }

  const filteredGoogle = googleEvents.filter((event) => inPeriod(event.start))
    .sort((a, b) => (a.start ?? "").localeCompare(b.start ?? ""));
  const filteredLocal = events.filter((event) => inPeriod(event.startsAt) && (categoryFilter === "all" || event.category === categoryFilter) && (!favoritesOnly || favoriteEventIds.includes(event.id)))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const visibleGoogle = showAllGoogle ? filteredGoogle : filteredGoogle.slice(0, 5);
  const visibleLocal = showAllLocal ? filteredLocal : filteredLocal.slice(0, 5);

  return (
    <section className="min-w-0 space-y-4 text-white">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-400">Eventos e tarefas MYRYRA + Google, em uma única visão.</p>
        <button type="button" onClick={() => setShowForm(value => !value)} aria-expanded={showForm}
          className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500">
          {showForm ? "Fechar formulário" : "+ Novo compromisso"}
        </button>
      </div>

      {tasksError && <p role="status" className="mt-3 text-xs text-amber-300">{tasksError}</p>}
      <div className="rounded-2xl border border-white/15 bg-slate-900/75 p-3 sm:p-5" aria-label="Smart Calendar">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-xs font-semibold uppercase tracking-widest text-violet-300">Smart Calendar · Beta</p><h3 className="mt-1 text-lg font-semibold capitalize">{calendarPeriod}</h3></div>
          <div className="flex flex-wrap gap-2">
            {(["day", "week", "month"] as const).map((view) => <button key={view} type="button" aria-pressed={calendarView === view} onClick={() => { setCalendarView(view); setCalendarOffset(0); setSelectedDay(null); }} className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${calendarView === view ? "bg-violet-500 text-white" : "border border-white/10 text-slate-300 hover:bg-white/10"}`}>{view === "day" ? "Dia" : view === "week" ? "Semana" : "Mês"}</button>)}
          </div>
        </div>
        <label className="mt-3 inline-flex flex-wrap items-center gap-2 text-xs text-slate-300">Categorias · Filtrar eventos MYRYRA por tema <select aria-label="Filtrar eventos MYRYRA no calendário por categoria" value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value as EventCategory | "all"); setShowAllLocal(false); }} className="rounded-lg border border-white/15 bg-slate-800 px-2 py-1.5 text-white"><option value="all">Todos</option>{Object.entries(EVENT_CATEGORIES).map(([id, item]) => <option key={id} value={id}>{item.label}</option>)}</select><span className="text-slate-500">Tarefas e Google Calendar não são filtrados</span></label>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {Object.entries(EVENT_CATEGORIES).map(([id, item]) => <button key={id} type="button" aria-pressed={categoryFilter === id} onClick={() => setCategoryFilter(id as EventCategory)} className={`flex items-center gap-2 rounded-lg border p-2 text-left text-xs ${categoryFilter === id ? "border-violet-400 bg-violet-500/15" : "border-white/10"}`}><span className="h-7 w-1 rounded-full" style={{backgroundColor:item.color}}/><span className="min-w-0"><span className="block font-semibold">{({work:"💼",family:"👨‍👩‍👧",leisure:"🌴",health:"❤️",personal:"✨",study:"📚"} as Record<string,string>)[id]} {item.label}</span><span className="block text-[11px] text-slate-400">{({work:"Reuniões e projetos",family:"Compromissos familiares",leisure:"Passeios e diversão",health:"Consultas e exercícios",personal:"Assuntos particulares",study:"Cursos e aprendizado"} as Record<string,string>)[id]}</span></span></button>)}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button type="button" onClick={() => setCalendarOffset((n) => n - 1)} aria-label="Período anterior" className="rounded-lg border border-white/10 px-3 py-1.5 hover:bg-white/10">‹</button>
          <button type="button" onClick={() => { setCalendarOffset(0); setSelectedDay(null); }} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs hover:bg-white/10">Hoje</button>
          <button type="button" onClick={() => setCalendarOffset((n) => n + 1)} aria-label="Próximo período" className="rounded-lg border border-white/10 px-3 py-1.5 hover:bg-white/10">›</button>
          <span className="ml-auto text-xs text-slate-400">Eventos + tarefas MYRYRA + Google</span>
        </div>
        <div className={`mt-4 grid gap-2 ${calendarView === "day" ? "grid-cols-1" : calendarView === "week" ? "grid-cols-2 md:grid-cols-7" : "grid-cols-3 sm:grid-cols-5 lg:grid-cols-7"}`}>
          {calendarDays.map(({ key, date, items }) => <button key={key} type="button" onClick={() => { setSelectedDay(key); setPeriodFilter("all"); }} aria-label={`Ver eventos de ${date.toLocaleDateString("pt-BR")}`} aria-pressed={selectedDay === key} className={`min-h-24 min-w-0 rounded-xl border p-2 text-left transition hover:border-violet-400/60 ${selectedDay === key ? "border-violet-400 bg-violet-500/15" : key === todayKey ? "border-violet-500/40 bg-violet-500/10" : "border-white/10 bg-slate-900/70"}`}>
            <span className="block text-xs font-semibold capitalize text-slate-300">{date.toLocaleDateString("pt-BR", { weekday: "short" })} {date.getDate()}</span>
            <span className="mt-2 block space-y-1">{items.slice(0, calendarView === "month" ? 2 : 3).map((item) => <span key={item.key} className="block truncate rounded border-l-4 bg-white/10 px-1.5 py-1 text-xs text-white" style={{ borderLeftColor: item.color }} title={item.title}>{item.at !== "Dia inteiro" ? `${item.at} · ` : ""}{item.title}</span>)}</span>
            {items.length > (calendarView === "month" ? 2 : 3) && <span className="mt-1 block text-xs text-slate-400">+{items.length - (calendarView === "month" ? 2 : 3)} eventos</span>}
          </button>)}
        </div>
        {selectedDay && <div className="mt-4 rounded-xl border border-violet-400/20 bg-violet-500/5 p-3">
          <p className="text-sm font-semibold text-violet-100">Horários potencialmente livres · 1 hora</p>
          <p className="mt-1 text-xs text-slate-400">Sugestões locais com base nos compromissos carregados. Não garantem disponibilidade e ainda não utilizam IA.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {suggestFreeHours(selectedDay).length ? suggestFreeHours(selectedDay).map((hour) => <button key={hour} type="button" onClick={() => startEventAtHour(selectedDay, hour)} className="rounded-lg border border-violet-400/30 bg-violet-500/10 px-3 py-2 text-xs font-semibold text-violet-100 hover:bg-violet-500/25">{String(hour).padStart(2, "0")}:00</button>) : <span className="text-xs text-slate-400">Nenhum horário sugerido neste período.</span>}
          </div>
        </div>}
        {selectedDay && <div className="mt-3 flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => startEventOnDay(selectedDay)} className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-500">+ Criar evento neste dia</button>
          <button type="button" onClick={() => setSelectedDay(null)} className="text-xs font-medium text-violet-300 underline">Limpar filtro do dia selecionado</button>
        </div>}
      </div>


      {showForm && <div id="myryra-calendar-event-form" className="mt-4 scroll-mt-8 rounded-xl border border-slate-700 p-4">
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
        <input
          type="text"
          value={title}
          onChange={(event) => { setTitle(event.target.value); if (!categoryChosen) setCategory(suggestEventCategory(event.target.value)); }}
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

      <label className="mt-4 block space-y-2 text-sm">
        <span className="block">Categoria do compromisso</span>
        <select value={category} onChange={(event) => { setCategory(event.target.value as EventCategory); setCategoryChosen(true); }} className="w-full rounded-xl border border-white/10 bg-slate-800 p-3 text-white">
          {Object.entries(EVENT_CATEGORIES).map(([id, item]) => <option key={id} value={id}>{item.label}</option>)}
        </select>
        <span className="block text-xs text-slate-400">A categoria é sugerida pelo título; você pode alterá-la.</span>
      </label>
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

      {eventType === "appointment" && <div className="mt-4 rounded-2xl border border-violet-500/30 bg-slate-900/70 p-4">
        <label className="flex cursor-pointer items-center gap-3 text-sm font-semibold">
          <input type="checkbox" checked={conciergeEnabled} onChange={e => setConciergeEnabled(e.target.checked)} className="h-4 w-4 accent-violet-500" />
          Ativar MIKA Concierge
        </label>
        <p className="mt-1 text-xs text-slate-400">Planeje o deslocamento e os serviços deste compromisso sem sair da Agenda.</p>
        {conciergeEnabled && <div className="mt-4 space-y-3">
          <label className="block space-y-1 text-sm"><span>Endereço de partida (opcional)</span>
            <input value={departureAddress} onChange={e => setDepartureAddress(e.target.value)} maxLength={300} placeholder="Casa, trabalho ou outro endereço" className="w-full rounded-xl border border-white/10 bg-slate-800 p-3 text-white" />
          </label>
          <p className="text-xs text-slate-400">O destino será o endereço do campo Local do compromisso.</p>
          <fieldset><legend className="mb-2 text-sm">Quais serviços você precisa?</legend>
            <div className="grid grid-cols-2 gap-2">
              {([["transport", "Transporte"], ["parking", "Estacionamento"], ["restaurant", "Restaurante"], ["hotel", "Hospedagem"]] as const).map(([id, label]) => (
                <label key={id} className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-800/70 p-3 text-xs sm:text-sm">
                  <input type="checkbox" checked={conciergeServices.includes(id)} onChange={e => setConciergeServices(current => e.target.checked ? [...current, id] : current.filter(item => item !== id))} className="accent-violet-500" />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          <p className="text-xs text-violet-200">A MIKA poderá sugerir opções e horários. Nenhuma reserva ou pagamento será realizado automaticamente.</p>
        </div>}
      </div>}
      <div className="mt-4 flex flex-wrap items-center gap-3">
      <button type="button" onClick={() => setShowForm(false)} disabled={saving}
        className="rounded-xl border border-slate-600 px-4 py-3 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-50">Cancelar</button>
      <button
        type="button"
        onClick={handleSave}
        disabled={saving || !title.trim() || !startsAt || !endsAt}
        className="rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-3 font-semibold text-white shadow-lg shadow-violet-900/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving ? "Salvando..." : "Adicionar compromisso"}
      </button>
      </div>

      </div>}
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
          <div role="alert" className="mt-3 space-y-2">
            <p className="text-sm text-amber-300">{googleError}</p>
            {googleReconnectRequired && <a href="/api/google/connect" className="inline-block rounded-lg border border-violet-500 px-3 py-2 text-sm text-violet-200">Reconectar Google Calendar</a>}
          </div>
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
                    <summary className="cursor-pointer list-none rounded-md py-1 pr-9 focus-visible:outline-2 focus-visible:outline-violet-400">
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
        <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">Eventos cadastrados</h3><label className="inline-flex items-center gap-2 text-xs text-slate-300">Tema <select aria-label="Filtrar eventos por categoria" value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value as EventCategory | "all"); setShowAllLocal(false); }} className="rounded-lg border border-white/15 bg-slate-800 px-2 py-1.5 text-white"><option value="all">Todos</option>{Object.entries(EVENT_CATEGORIES).map(([id, item]) => <option key={id} value={id}>{item.label}</option>)}</select></label><label className="inline-flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={favoritesOnly} onChange={(event) => setFavoritesOnly(event.target.checked)} className="accent-violet-500" />★ Somente favoritos</label></div>

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
              className="relative ml-2 rounded-lg border border-slate-700 border-l-4 bg-slate-950/50 p-3" style={{ borderLeftColor: EVENT_CATEGORIES[event.category].color }}
            >
              <button type="button" onClick={() => void toggleFavoriteEvent(event)} disabled={favoriteBusyId !== null}
                aria-pressed={favoriteEventIds.includes(event.id)}
                aria-label={favoriteEventIds.includes(event.id) ? "Remover compromisso dos favoritos" : "Favoritar compromisso"}
                title={favoriteEventIds.includes(event.id) ? "Remover favorito" : "Adicionar favorito"}
                className={`absolute right-3 top-2 z-10 rounded-md px-1.5 text-xl hover:bg-violet-500/15 disabled:opacity-50 ${favoriteEventIds.includes(event.id) ? "text-amber-300" : "text-slate-400"}`}>
                {favoriteEventIds.includes(event.id) ? "★" : "☆"}
              </button>
              <details className="group">
                <summary className="cursor-pointer list-none rounded-md py-1 focus-visible:outline-2 focus-visible:outline-violet-400">
                  <span className="flex min-w-0 items-center justify-between gap-3">
                    <span className="min-w-0 break-words font-semibold"><span className="mr-2 text-xs font-semibold tabular-nums text-violet-300">{timeLabel(event.startsAt)}</span>{event.title}</span>
                    <span className="shrink-0 text-xs text-slate-400 group-open:hidden">Detalhes +</span><span className="hidden shrink-0 text-xs text-slate-400 group-open:inline">Recolher −</span>
                  </span>
                </summary>
                <div className="mt-3 flex items-start justify-between gap-3 border-t border-slate-800 pt-3">
                <div>

                  <p className="mt-1 text-xs font-semibold" style={{ color: EVENT_CATEGORIES[event.category].color }}>{EVENT_CATEGORIES[event.category].label}</p>
                  <label className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-300">
                    Categoria
                    <select aria-label={`Categoria de ${event.title}`} value={event.category}
                      disabled={categoryBusyId !== null}
                      onChange={(e) => void handleCategoryChange(event.id, e.target.value as EventCategory)}
                      className="rounded-lg border border-white/15 bg-slate-800 px-2 py-1.5 text-white disabled:opacity-50">
                      {Object.entries(EVENT_CATEGORIES).map(([id, item]) => <option key={id} value={id}>{item.label}</option>)}
                    </select>
                  </label>
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
                  {event.concierge && <div className="mt-3 rounded-xl border border-violet-500/30 bg-violet-500/10 p-3 text-sm">
                    <p className="font-semibold text-violet-200">MIKA Concierge · Planejamento ativo</p>
                    <p className="mt-1 text-xs text-slate-300">Partida: {event.concierge.departureAddress || "A definir com a MIKA"}</p>
                    <p className="mt-1 text-xs text-slate-300">Serviços: {event.concierge.services.map(service => ({ transport: "Transporte", parking: "Estacionamento", restaurant: "Restaurante", hotel: "Hospedagem" }[service] || service)).join(", ") || "Nenhum selecionado"}</p>
                    <p className="mt-2 text-xs text-slate-400">As opções ainda precisam ser planejadas. Reservas e pagamentos exigem confirmação.</p>
                    <button type="button" onClick={() => planWithMyka(event)} className="mt-3 rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-500">Planejar com a MIKA</button>
                  </div>}
                </div>

                <EventReminderControl eventId={event.id} startsAt={event.startsAt} />
                <div className="flex flex-col gap-2">
                  {editingId === event.id ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <input aria-label="Novo título do compromisso" value={editingTitle} maxLength={200}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        className="min-w-0 flex-1 rounded-lg border border-violet-400/50 bg-slate-800 px-3 py-2 text-sm text-white" />
                      <button type="button" onClick={() => void handleRename()} disabled={renaming || !editingTitle.trim()}
                        className="rounded-lg bg-violet-600 px-3 py-2 text-sm disabled:opacity-50">{renaming ? "Salvando..." : "Salvar"}</button>
                      <button type="button" onClick={() => setEditingId(null)} disabled={renaming}
                        className="rounded-lg border border-white/20 px-3 py-2 text-sm">Cancelar</button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => { setEditingId(event.id); setEditingTitle(event.title); }}
                      className="self-start rounded-lg border border-violet-400/40 px-3 py-2 text-sm text-violet-200">Editar título</button>
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
