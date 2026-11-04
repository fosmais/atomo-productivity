"use client";

import { useEffect, useState } from "react";
import { getCloudEvents, type CalendarEvent } from "@/lib/event-cloud";

const storageKey = "myryra:reminder-minutes:v1";
const shownKey = "myryra:reminder-shown:v1";
type Minutes = 0 | 10 | 15 | 30;
export default function EventReminders() {
  const [minutes, setMinutes] = useState<Minutes>(15);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [alerts, setAlerts] = useState<string[]>([]);
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    try { const stored = Number(localStorage.getItem(storageKey)); if ([0, 10, 15, 30].includes(stored)) setMinutes(stored as Minutes); } catch { /* optional */ }
    setEnabled(true);
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
    if (!enabled || !minutes) return;
    function check() {
      const now = Date.now();
      const due = events.filter(event => {
        const difference = new Date(event.startsAt).getTime() - now;
        return difference > 0 && difference <= minutes * 60000;
      });
      let seen: string[] = [];
      try { seen = JSON.parse(sessionStorage.getItem(shownKey) || "[]") as string[]; } catch { /* optional */ }
      const fresh = due.filter(event => !seen.includes(event.id));
      if (!fresh.length) return;
      setAlerts(previous => [...previous, ...fresh.map(event => `${event.title} começa em até ${minutes} minutos.`)].slice(-3));
      try { sessionStorage.setItem(shownKey, JSON.stringify([...seen, ...fresh.map(event => event.id)].slice(-200))); } catch { /* optional */ }
    }
    check();
    const interval = window.setInterval(check, 30000);
    return () => window.clearInterval(interval);
  }, [events, minutes, enabled]);
  return <div className="relative">
    {alerts.length > 0 && <div role="status" aria-live="polite" className="fixed inset-x-3 top-4 z-[60] mx-auto max-w-md space-y-2">
      {alerts.map((alert, index) => <div key={index} className="flex items-start justify-between gap-3 rounded-xl border border-violet-400 bg-slate-900 p-3 text-sm text-white shadow-xl"><span>⏰ {alert}</span><button type="button" aria-label="Dispensar aviso" onClick={() => setAlerts(old => old.filter((_, i) => i !== index))}>✕</button></div>)}
    </div>}
    <label className="flex flex-wrap items-center gap-3 text-sm text-slate-200">
      Avisar antes de compromissos
      <select aria-label="Antecedência do lembrete" value={minutes} onChange={e => {
        const value = Number(e.target.value) as Minutes;
        setMinutes(value);
        try { localStorage.setItem(storageKey, String(value)); } catch { /* optional */ }
      }} className="rounded-lg border border-white/20 bg-slate-950 px-3 py-2 text-white">
        <option value={0}>Desativado</option><option value={10}>10 minutos</option><option value={15}>15 minutos</option><option value={30}>30 minutos</option>
      </select>
    </label>
    <p className="mt-1 text-xs text-slate-400">Avisos dentro da MYRYRA enquanto esta página estiver aberta. Configuração salva neste navegador; não envia push com o aplicativo fechado.</p>
  </div>;
}
