"use client";

import { useState } from "react";
import { scheduleEventReminder, type ReminderLeadMinutes } from "@/lib/event-reminders";

export default function EventReminderControl({ eventId, startsAt }: { eventId: string; startsAt: string }) {
  const [minutes, setMinutes] = useState<ReminderLeadMinutes>(15);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  if (new Date(startsAt).getTime() <= Date.now()) return null;

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    setSuccess(false);
    setError("");
    try {
      await scheduleEventReminder(eventId, minutes);
      setSuccess(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível registrar o lembrete.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="w-full min-w-0 rounded-lg border border-violet-400/20 p-3 text-sm xl:w-auto">
      <label className="flex min-w-0 flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        Lembrar antes
        <select value={minutes} onChange={(event) => { setMinutes(Number(event.target.value) as ReminderLeadMinutes); setSuccess(false); }}
          className="min-h-11 min-w-0 max-w-full rounded-lg border border-slate-600 bg-slate-900 px-2 py-2 text-white">
          <option value={5}>5 minutos</option>
          <option value={10}>10 minutos</option>
          <option value={15}>15 minutos</option>
          <option value={30}>30 minutos</option>
          <option value={60}>1 hora</option>
          <option value={1440}>1 dia</option>
        </select>
        <button type="button" onClick={() => void handleSave()} disabled={saving}
          className="min-h-11 max-w-full rounded-lg bg-violet-600 px-3 py-2 font-semibold text-white disabled:opacity-50">
          {saving ? "Registrando..." : "Configurar lembrete"}
        </button>
      </label>
      {success && <p role="status" className="mt-2 text-emerald-300">Lembrete registrado. O envio automático de notificações ainda não está disponível.</p>}
      {!success && <p className="mt-2 text-xs text-slate-400">A configuração fica salva na MYRYRA, mas os alertas automáticos ainda não estão ativos.</p>}
      {error && <p role="alert" className="mt-2 text-rose-300">{error}</p>}
    </div>
  );
}
