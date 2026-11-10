"use client";

import { useState } from "react";
import { getCloudEvents, saveCloudEvent } from "@/lib/event-cloud";

type GoogleBusy = { start: string | null; end: string | null; status?: string | null; transparency?: string | null };
async function getGoogleBusy(): Promise<{ connected: boolean; events: GoogleBusy[] }> {
  const response = await fetch("/api/google/events", { cache: "no-store" });
  if (!response.ok) throw new Error(response.status === 409 ? "Reconecte seu Google Calendar antes de agendar." : "Não foi possível verificar o Google Calendar. Tente novamente.");
  const data: { connected?: boolean; events?: GoogleBusy[] } = await response.json();
  if (!Array.isArray(data.events) || data.events.some(event => !event || typeof event !== "object")) throw new Error("Resposta inesperada do Google Calendar.");
  return { connected: data.connected === true, events: data.events };
}
function hasConflict(start: number, end: number, events: { startsAt: string; endsAt: string; blocksTime: boolean }[], google: GoogleBusy[]) {
  return events.some(event => event.blocksTime && Date.parse(event.startsAt) < end && Date.parse(event.endsAt) > start)
    || google.some(event => event.status !== "cancelled" && event.transparency !== "transparent" && (!event.start || !event.end || !Number.isFinite(Date.parse(event.start)) || !Number.isFinite(Date.parse(event.end)) || (Date.parse(event.start) < end && Date.parse(event.end) > start)));
}

export default function MikaReviewCalendar({ title }: { title: string }) {
  const [start, setStart] = useState("");
  const [working, setWorking] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [message, setMessage] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggesting, setSuggesting] = useState(false);
  const [googleChecked, setGoogleChecked] = useState<boolean | null>(null);
  const [destination, setDestination] = useState<"myryra" | "google">("myryra");
  const [reconnectUrl, setReconnectUrl] = useState<string | null>(null);
  const [createdEventUrl, setCreatedEventUrl] = useState<string | null>(null);
  async function suggestTimes() {
    if (suggesting || confirmed) return;
    setSuggesting(true);
    setMessage("");
    try {
      const [events, google] = await Promise.all([getCloudEvents(), getGoogleBusy()]);
      setGoogleChecked(google.connected);
      const slots: string[] = [];
      const now = new Date();
      for (let dayOffset = 0; dayOffset < 7 && slots.length < 3; dayOffset++) {
        for (const hour of [9, 11, 14, 16, 19]) {
          const candidate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset, hour, 0);
          const end = candidate.getTime() + 20 * 60_000;
          if (candidate.getTime() < Date.now() + 30 * 60_000) continue;
          if (hasConflict(candidate.getTime(), end, events, google.events)) continue;
          const local = [candidate.getFullYear(), String(candidate.getMonth() + 1).padStart(2, "0"), String(candidate.getDate()).padStart(2, "0")].join("-") + "T" + String(hour).padStart(2, "0") + ":00";
          slots.push(local);
          if (slots.length === 3) break;
        }
      }
      setSuggestions(slots);
      if (!slots.length) setMessage("Nenhum horário livre encontrado nos próximos sete dias. Escolha manualmente.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível consultar a agenda."); }
    finally { setSuggesting(false); }
  }
  async function confirm() {
    if (working || confirmed) return;
    const startDate = new Date(start);
    if (!start || !Number.isFinite(startDate.getTime()) || startDate.getTime() <= Date.now()) {
      setMessage("Selecione uma data e um horário futuros.");
      return;
    }
    const endDate = new Date(startDate.getTime() + 20 * 60_000);
    setWorking(true);
    setMessage("");
    setReconnectUrl(null);
    setCreatedEventUrl(null);
    try {
      const [events, google] = await Promise.all([getCloudEvents(), getGoogleBusy()]);
      const overlapping = hasConflict(startDate.getTime(), endDate.getTime(), events, google.events);
      if (overlapping) {
        setMessage("Há um compromisso ou bloqueio nesse horário. Escolha outro período.");
        return;
      }
      if (destination === "google") {
        if (!google.connected) { setMessage("Conecte o Google Calendar antes de agendar."); return; }
        const response = await fetch("/api/google/events/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: title.slice(0, 200), startsAt: startDate.toISOString(), endsAt: endDate.toISOString() }),
        });
        const result: { error?: string; code?: string; reconnectUrl?: string; alreadyExists?: boolean; url?: string } = await response.json();
        if (result.code === "GOOGLE_CALENDAR_RECONNECT_REQUIRED" || result.code === "GOOGLE_WRITE_CONSENT_REQUIRED") setReconnectUrl("/api/google/connect?allow_event_creation=1");
        if (!response.ok) throw new Error(result.error || "Não foi possível criar o evento no Google.");
        if (typeof result.url === "string" && /^https:\/\/calendar\.google\.com\//.test(result.url)) setCreatedEventUrl(result.url);
        setConfirmed(true);
        setMessage(result.alreadyExists ? "Esse treinamento já estava no Google Calendar." : "Treinamento criado no Google Calendar.");
        return;
      }
      await saveCloudEvent({ title: title.slice(0, 200), startsAt: startDate.toISOString(), endsAt: endDate.toISOString(), category: "personal", eventType: "appointment", blocksTime: true, notes: "Treinamento MIKA · revisão de 20 minutos sugerida após exercício. Criado com autorização do usuário." });
      setConfirmed(true);
      setMessage("Treinamento de 20 minutos adicionado à Agenda MYRYRA.");
      window.dispatchEvent(new Event("myryra:events-updated"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível agendar a revisão.");
    } finally { setWorking(false); }
  }
  return <div className="mt-3 space-y-2 rounded-lg border border-emerald-300/30 p-3">
    <label className="block font-semibold text-emerald-100">Reservar 20 minutos de treinamento</label>
    <label className="block text-slate-200">Salvar em <select aria-label="Destino do treinamento" value={destination} disabled={working || confirmed} onChange={event => setDestination(event.target.value as "myryra" | "google")} className="ml-2 rounded-lg border border-slate-500 bg-slate-900 p-2 text-white"><option value="myryra">Agenda MYRYRA</option><option value="google">Google Calendar</option></select></label>
    <p className="text-slate-200">Escolha um único destino para evitar duplicidade. O Google exige autorização de criação de eventos.</p>
    <p className="text-slate-200">Opcional: você pode autorizar separadamente a criação de eventos no Google. Essa autorização não cria nenhum compromisso automaticamente.</p>
    {destination === "google" && <a href="/api/google/connect?allow_event_creation=1" className="inline-block rounded-lg border border-violet-200/50 px-3 py-2 text-violet-100">Autorizar criação de eventos no Google</a>}
    {reconnectUrl && <a href={reconnectUrl} className="inline-block rounded-lg border border-amber-200/50 px-3 py-2 text-amber-100">Reconectar Google Calendar para continuar</a>}
    <button type="button" disabled={suggesting || working || confirmed} onClick={() => void suggestTimes()} className="rounded-lg border border-violet-200/50 px-3 py-2 font-semibold text-violet-100 disabled:opacity-40">{suggesting ? "Consultando agenda..." : "Sugerir horários livres"}</button>
    {suggestions.length > 0 && <div className="flex flex-wrap gap-2">{suggestions.map(slot => <button type="button" key={slot} disabled={working || confirmed} onClick={() => setStart(slot)} className="rounded-lg border border-emerald-200/40 px-3 py-2 text-emerald-100">{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(slot))}</button>)}</div>}
    <input aria-label="Início do treinamento" type="datetime-local" value={start} disabled={working || confirmed} onChange={event => setStart(event.target.value)} className="max-w-full rounded-lg border border-slate-500 bg-slate-900 p-2 text-white" />
    <button type="button" disabled={working || confirmed || !start} onClick={() => void confirm()} className="rounded-lg border border-emerald-200/50 px-3 py-2 font-semibold text-emerald-100 disabled:opacity-40">{working ? "Verificando disponibilidade..." : confirmed ? "Agendado" : "Confirmar na Agenda"}</button>
    <p className="text-slate-200">As sugestões consideram compromissos e bloqueios MYRYRA e, quando conectado, os eventos Google. O treinamento será criado somente no destino escolhido, após sua confirmação.</p>
    {googleChecked === false && <p role="status" className="text-amber-100">Google Calendar não conectado: os horários foram verificados apenas na MYRYRA. Confira seus outros calendários antes de confirmar.</p>}
    {message && <p role="status">{message}</p>}
    {createdEventUrl && <a href={createdEventUrl} target="_blank" rel="noopener noreferrer" className="inline-block rounded-lg border border-emerald-200/50 px-3 py-2 font-semibold text-emerald-100">Ver treinamento no Google Calendar</a>}
  </div>;
}
