"use client";

import { useState } from "react";
import { getCloudEvents, saveCloudEvent } from "@/lib/event-cloud";

export default function MikaReviewCalendar({ title }: { title: string }) {
  const [start, setStart] = useState("");
  const [working, setWorking] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [message, setMessage] = useState("");
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
    try {
      const events = await getCloudEvents();
      const overlapping = events.some(event => event.blocksTime && Date.parse(event.startsAt) < endDate.getTime() && Date.parse(event.endsAt) > startDate.getTime());
      if (overlapping) {
        setMessage("Há um bloqueio na sua agenda nesse horário. Escolha outro período.");
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
    <label className="block font-semibold text-emerald-100">Reservar 20 minutos na Agenda MYRYRA</label>
    <input aria-label="Início do treinamento" type="datetime-local" value={start} disabled={working || confirmed} onChange={event => setStart(event.target.value)} className="max-w-full rounded-lg border border-slate-500 bg-slate-900 p-2 text-white" />
    <button type="button" disabled={working || confirmed || !start} onClick={() => void confirm()} className="rounded-lg border border-emerald-200/50 px-3 py-2 font-semibold text-emerald-100 disabled:opacity-40">{working ? "Verificando disponibilidade..." : confirmed ? "Agendado" : "Confirmar na Agenda"}</button>
    <p className="text-slate-200">A MIKA verifica bloqueios existentes antes de salvar. O compromisso é criado somente após sua confirmação.</p>
    {message && <p role="status">{message}</p>}
  </div>;
}
