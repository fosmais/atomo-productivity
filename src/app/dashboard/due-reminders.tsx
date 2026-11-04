"use client";

import { useEffect, useState } from "react";
import { listDueEventReminders, type DueEventReminder } from "@/lib/event-reminders";

export default function DueReminders() {
  const [items, setItems] = useState<DueEventReminder[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function refresh() {
      if (document.visibilityState !== "visible") return;
      try {
        const reminders = await listDueEventReminders();
        if (active) { setItems(reminders); setError(""); }
      } catch {
        if (active) setError("Não foi possível consultar os lembretes. A configuração pode ainda não estar habilitada.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void refresh();
    const interval = window.setInterval(() => { void refresh(); }, 60_000);
    const onVisibility = () => { void refresh(); };
    const onEvents = () => { void refresh(); };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("myryra:events-updated", onEvents);
    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("myryra:events-updated", onEvents);
    };
  }, []);

  return <section aria-label="Lembretes da agenda" className="rounded-xl border border-violet-400/25 bg-slate-900/70 p-4 text-white">
    <h3 className="font-semibold">Lembretes da agenda</h3>
    <p className="mt-1 text-xs text-slate-400">Avisos disponíveis nesta página enquanto ela estiver aberta. Notificações por push e e-mail ainda não estão ativas.</p>
    {loading ? <p className="mt-3 text-sm text-slate-300">Consultando lembretes...</p> :
      error ? <p role="alert" className="mt-3 text-sm text-amber-200">{error}</p> :
      items.length ? <ul className="mt-3 space-y-2">{items.map(item =>
        <li key={item.id} className="rounded-lg border border-violet-400/20 p-3 text-sm">
          <strong>{item.events?.title ?? "Compromisso"}</strong>
          <span className="ml-2 text-slate-300">· {item.minutes_before} min antes · {new Date(item.events?.starts_at ?? item.remind_at).toLocaleString("pt-BR")}</span>
        </li>
      )}</ul> : <p className="mt-3 text-sm text-slate-400">Nenhum lembrete atingiu o horário de aviso.</p>}
  </section>;
}
