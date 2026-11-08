"use client";

import { useState } from "react";

type EventItem = { id: string; title: string; start: string; end: string; webLink: string | null };
export default function MicrosoftCalendarPreview() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [reconnect, setReconnect] = useState(false);
  const [connected, setConnected] = useState(false);

  async function load() {
    setBusy(true); setMessage(""); setReconnect(false);
    try {
      const response = await fetch("/api/microsoft/calendar", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) {
        if (data.code === "MICROSOFT_RECONNECT_REQUIRED") setReconnect(true);
        throw new Error(data.error || "Falha ao consultar calendário.");
      }
      if (!data.connected) {
        setReconnect(true);
        throw new Error("Conecte sua conta Microsoft para consultar o calendário.");
      }
      setConnected(true);
      setEvents(Array.isArray(data.events) ? data.events : []);
      setLoaded(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha na consulta.");
    } finally { setBusy(false); }
  }

  async function disconnect() {
    if (busy || !window.confirm("Desconectar sua conta Microsoft da MYRYRA?")) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/microsoft/disconnect", { method: "POST" });
      if (!response.ok) throw new Error("Não foi possível desconectar.");
      setEvents([]); setConnected(false); setLoaded(false); setReconnect(false);
      setMessage("Conta Microsoft desconectada.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao desconectar.");
    } finally { setBusy(false); }
  }

  return <div className="space-y-3 rounded-2xl border border-violet-400/20 bg-slate-950/50 p-4">
    <h3 className="font-semibold text-white">Microsoft Outlook · Calendário</h3>
    <p className="text-sm text-slate-300">Consulta de leitura dos próximos 30 dias. Nenhum compromisso será alterado ou importado automaticamente.</p>
    <div className="flex flex-wrap gap-3">
      <button type="button" disabled={busy} onClick={() => void load()} className="rounded-lg bg-violet-600 px-3 py-2 text-sm text-white disabled:opacity-50">{busy ? "Aguarde..." : "Consultar Outlook"}</button>
      {(reconnect || !connected) && <a href="/api/microsoft/connect" className="self-center text-sm text-violet-300 underline">Conectar Microsoft</a>}
      {connected && <button type="button" disabled={busy} onClick={() => void disconnect()} className="rounded-lg border border-violet-400/30 px-3 py-2 text-sm text-violet-200 disabled:opacity-50">Desconectar</button>}
    </div>
    {loaded && <div className="space-y-2">
      <p className="text-xs text-slate-300">{events.length} compromisso(s) encontrados.</p>
      <ul className="max-h-64 space-y-2 overflow-y-auto text-sm text-slate-300">
        {events.map(event => <li key={event.id} className="rounded-lg border border-white/10 p-2">
          <div className="font-medium text-white">{event.title}</div>
          <div className="text-xs">{event.start} — {event.end}</div>
          {event.webLink && <a href={event.webLink} target="_blank" rel="noopener noreferrer" className="text-xs text-violet-300 underline">Abrir no Outlook</a>}
        </li>)}
      </ul>
    </div>}
    {message && <p role="status" className="text-sm text-amber-200">{message}</p>}
  </div>;
}
