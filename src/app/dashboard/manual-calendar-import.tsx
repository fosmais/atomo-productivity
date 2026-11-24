"use client";

import { useState } from "react";
import { getCloudEvents, saveCloudEvent, type NewCalendarEvent } from "@/lib/event-cloud";

function parseIcs(text: string): NewCalendarEvent[] {
  const unfolded = text.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "");
  const lines = unfolded.split(/\r?\n/);
  const events: NewCalendarEvent[] = [];
  let current: Record<string, string> | null = null;
  const decode = (value: string) => value.replace(/\\n/gi, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");
  const parseDate = (value: string) => {
    if (!/^\d{8}T\d{6}Z$/.test(value)) throw new Error("Este arquivo contém horários sem UTC. Exporte um calendário com horários UTC para evitar deslocamento de fuso.");
    const iso = value.slice(0, 4) + "-" + value.slice(4, 6) + "-" + value.slice(6, 8) + "T" + value.slice(9, 11) + ":" + value.slice(11, 13) + ":" + value.slice(13, 15) + "Z";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime()) || d.toISOString() !== iso.replace("Z", ".000Z")) throw new Error("Data inválida no calendário.");
    return d.toISOString();
  };
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") { current = {}; continue; }
    if (line === "END:VEVENT" && current) {
      const title = decode(current.SUMMARY ?? "").trim();
      if (title && current.DTSTART && current.DTEND && current.STATUS !== "CANCELLED") {
        if (title.length > 200) throw new Error("Um compromisso excede 200 caracteres no título.");
        const startsAt = parseDate(current.DTSTART), endsAt = parseDate(current.DTEND);
        if (new Date(endsAt) <= new Date(startsAt)) throw new Error("Compromisso com término anterior ao início.");
        events.push({ title, startsAt, endsAt, location: decode(current.LOCATION ?? "").slice(0, 250), eventType: "appointment", blocksTime: true });
        if (events.length > 100) throw new Error("Importe até 100 compromissos por arquivo.");
      }
      current = null; continue;
    }
    if (!current) continue;
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    const key = line.slice(0, colon).split(";")[0].toUpperCase();
    if (["SUMMARY", "DTSTART", "DTEND", "LOCATION", "STATUS"].includes(key)) current[key] = line.slice(colon + 1);
  }
  if (!events.length) throw new Error("Nenhum compromisso válido encontrado no arquivo.");
  return events;
}

export default function ManualCalendarImport() {
  const [events, setEvents] = useState<NewCalendarEvent[]>([]);
  const [fileName, setFileName] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function readFile(file?: File) {
    setEvents([]); setConfirmed(false); setError(""); setMessage(""); setFileName("");
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".ics") || file.size > 1024 * 1024) { setError("Selecione um arquivo .ics de até 1 MB."); return; }
    try { setEvents(parseIcs(await file.text())); setFileName(file.name); }
    catch (err) { setError(err instanceof Error ? err.message : "Arquivo de calendário inválido."); }
  }

  async function importEvents() {
    if (!confirmed || !events.length || busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const existing = await getCloudEvents();
      const seen = new Set(existing.map(event => [event.title.trim().toLocaleLowerCase("pt-BR"), event.startsAt, event.endsAt].join("|")));
      let added = 0, ignored = 0;
      for (const event of events) {
        const key = [event.title.trim().toLocaleLowerCase("pt-BR"), event.startsAt, event.endsAt].join("|");
        if (seen.has(key)) { ignored++; continue; }
        await saveCloudEvent(event);
        seen.add(key); added++;
      }
      setMessage(added + " compromisso(s) importado(s). " + ignored + " duplicata(s) ignorada(s).");
      setEvents([]); setConfirmed(false); setFileName("");
    } catch (err) { setError((err instanceof Error ? err.message : "Falha ao importar.") + " Os compromissos anteriores ao erro podem ter sido salvos; confira a Agenda antes de tentar novamente."); }
    finally { setBusy(false); }
  }

  return <section className="space-y-3 rounded-2xl border border-violet-400/20 bg-slate-950/50 p-4">
    <h3 className="text-base font-semibold text-white">Importar compromissos · Outlook / ICS</h3>
    <p className="text-sm leading-6 text-slate-300">Selecione um arquivo .ics exportado do calendário. A MYRYRA exibirá uma prévia e importará somente após sua confirmação. Nesta versão, são aceitos apenas eventos com horários UTC (terminados em Z), para evitar erros de fuso horário.</p>
    <input type="file" accept=".ics,text/calendar" aria-label="Selecionar calendário ICS" disabled={busy} onChange={event => void readFile(event.target.files?.[0])} className="block w-full text-sm text-slate-200 file:mr-3 file:rounded-lg file:border-0 file:bg-violet-600 file:px-3 file:py-2 file:text-white" />
    {events.length > 0 && <div className="space-y-3">
      <p className="text-sm text-violet-200">{events.length} compromisso(s) encontrado(s) em {fileName}.</p>
      <ul className="max-h-48 space-y-1 overflow-y-auto text-sm text-slate-300">{events.slice(0, 10).map((event, i) => <li key={i} className="rounded-lg bg-slate-900 px-3 py-2">{event.title} · {new Date(event.startsAt).toLocaleString("pt-BR")}</li>)}</ul>
      <label className="flex items-start gap-2 text-sm text-slate-200"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} className="mt-1 accent-violet-500" disabled={busy}/> Conferi os horários e autorizo adicionar os compromissos à minha Agenda.</label>
      <button type="button" onClick={() => void importEvents()} disabled={busy || !confirmed} className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Importando..." : "Confirmar importação"}</button>
    </div>}
    {message && <p role="status" className="text-sm text-emerald-300">{message}</p>}
    {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
  </section>;
}
