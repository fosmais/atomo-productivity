"use client";

import { useEffect, useState } from "react";
import { getCloudEvents, type CalendarEvent } from "@/lib/event-cloud";

const storageKey = "myryra:reminder-minutes:v1";
const shownKey = "myryra:reminder-shown:v2";
const overridesKey = "myryra:reminder-overrides:v1";
type Minutes = 0 | 10 | 15 | 30;
export default function EventReminders({ showControls = false }: { showControls?: boolean }) {
  const [minutes, setMinutes] = useState<Minutes>(15);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [overrides, setOverrides] = useState<Record<string, Minutes>>({});
  const [alerts, setAlerts] = useState<string[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [renderNow, setRenderNow] = useState<number | null>(null);
  useEffect(() => {
    let active = true;
    const updateClock = () => { if (active) setRenderNow(Date.now()); };
    queueMicrotask(updateClock);
    const timer = window.setInterval(updateClock, 30000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      try { const stored = Number(localStorage.getItem(storageKey)); if ([0, 10, 15, 30].includes(stored)) setMinutes(stored as Minutes); } catch { /* optional */ }
      try { const stored = JSON.parse(localStorage.getItem(overridesKey) || "{}"); if (stored && typeof stored === "object" && !Array.isArray(stored)) setOverrides(stored); } catch { /* optional */ }
      setEnabled(true);
    });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const load = async () => {
      try { const list = await getCloudEvents(); if (alive) setEvents(list); } catch { /* no toast if offline */ }
    };
    void load();
    const refresh = () => void load();
    window.addEventListener("myryra:events-updated", refresh);
    const interval = window.setInterval(load, 5 * 60 * 1000);
    return () => { alive = false; window.clearInterval(interval); window.removeEventListener("myryra:events-updated", refresh); };
  }, [enabled]);
  useEffect(() => {
    if (!enabled) return;
    function check() {
      const now = Date.now();
      const due = events.filter(event => {
        const difference = new Date(event.startsAt).getTime() - now;
        const lead = [0, 10, 15, 30].includes(overrides[event.id]) ? overrides[event.id] : minutes;
        return lead > 0 && difference > 0 && difference <= lead * 60000;
      });
      let seen: string[] = [];
      try { seen = JSON.parse(sessionStorage.getItem(shownKey) || "[]") as string[]; } catch { /* optional */ }
      const fresh = due.filter(event => !seen.includes(`${event.id}:${event.startsAt}`));
      if (!fresh.length) return;
      setAlerts(previous => [...previous, ...fresh.map(event => `${event.title} começa em breve (${overrides[event.id] ?? minutes} min de antecedência).`)].slice(-3));
      try { sessionStorage.setItem(shownKey, JSON.stringify([...seen, ...fresh.map(event => `${event.id}:${event.startsAt}`)].slice(-200))); } catch { /* optional */ }
    }
    check();
    const interval = window.setInterval(check, 30000);
    return () => window.clearInterval(interval);
  }, [events, minutes, overrides, enabled]);
  return <div className="relative">
    {alerts.length > 0 && <div role="status" aria-live="polite" className="fixed inset-x-3 top-4 z-[60] mx-auto max-w-md space-y-2">
      {alerts.map((alert, index) => <div key={index} className="flex items-start justify-between gap-3 rounded-xl border border-violet-400 bg-slate-900 p-3 text-sm text-white shadow-xl"><span>⏰ {alert}</span><button type="button" aria-label="Dispensar aviso" onClick={() => setAlerts(old => old.filter((_, i) => i !== index))}>✕</button></div>)}
    </div>}
    {showControls && <label className="flex flex-wrap items-center gap-3 text-sm text-slate-200">
      Avisar antes de compromissos
      <select aria-label="Antecedência do lembrete" value={minutes} onChange={e => {
        const value = Number(e.target.value) as Minutes;
        setMinutes(value);
        try { localStorage.setItem(storageKey, String(value)); } catch { /* optional */ }
      }} className="rounded-lg border border-white/20 bg-slate-950 px-3 py-2 text-white">
        <option value={0}>Desativado</option><option value={10}>10 minutos</option><option value={15}>15 minutos</option><option value={30}>30 minutos</option>
      </select>
    </label>}
    {showControls && events.filter(event => renderNow !== null && new Date(event.startsAt).getTime() > renderNow).slice(0, 12).length > 0 && <div className="mt-3 space-y-2">
      <p className="text-xs font-semibold text-violet-200">Personalize o aviso dos próximos compromissos</p>
      {events.filter(event => new Date(event.startsAt).getTime() > Date.now()).slice(0, 12).map(event => <div key={event.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 p-2">
        <span className="min-w-0 text-xs text-slate-200"><span className="block truncate font-semibold">{event.title}</span><span className="text-slate-400">{new Date(event.startsAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span></span>
        <select aria-label={`Aviso para ${event.title}`} value={overrides[event.id] ?? "default"} onChange={e => {
          const next = { ...overrides };
          if (e.target.value === "default") delete next[event.id];
          else next[event.id] = Number(e.target.value) as Minutes;
          setOverrides(next);
          try { localStorage.setItem(overridesKey, JSON.stringify(next)); } catch { /* optional */ }
        }} className="max-w-full rounded-lg border border-white/20 bg-slate-950 px-2 py-1.5 text-xs text-white">
          <option value="default">Padrão</option><option value={0}>Sem aviso</option><option value={10}>10 min</option><option value={15}>15 min</option><option value={30}>30 min</option>
        </select>
      </div>)}
    </div>}
    {showControls && <p className="mt-1 text-xs text-slate-400">Avisos dentro da MYRYRA enquanto esta página estiver aberta. Configurações salvas neste navegador. Os avisos dependem da página aberta; não há push com o aplicativo fechado.</p>}
  </div>;
}
