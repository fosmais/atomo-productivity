"use client";

import { useEffect, useState } from "react";
import { useVyraNavigation } from "./vyra-module-context";
import { getCloudEvents, saveCloudEvent } from "@/lib/event-cloud";

type Plan = {
  focusSuggestion: { title: string; startsAt: string; endsAt: string; minutes: number } | null;
  pendingTasks: number;
  overdueTasks: number;
  todayEvents: number;
  conflicts: { first: string; second: string }[];
  priorities: { title: string; priority: string; dueDate: string | null }[];
  freeSlots: { startsAt: string; endsAt: string; minutes: number }[];
};

function localIso(date: Date) {
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  const hh = String(Math.floor(Math.abs(offset) / 60)).padStart(2, "0");
  const mm = String(Math.abs(offset) % 60).padStart(2, "0");
  const local = new Date(date.getTime() + offset * 60000).toISOString().slice(0, 19);
  return `${local}${sign}${hh}:${mm}`;
}

export default function MikaResolveMyDay() {
  const { navigateTo } = useVyraNavigation();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingFocus, setSavingFocus] = useState(false);
  const [focusSaved, setFocusSaved] = useState(false);
  const [focusMessage, setFocusMessage] = useState("");
  const [error, setError] = useState("");
  // A plan is a snapshot. Invalidate it after task changes or when the user
  // returns to the app, so completed tasks are never presented as fresh advice.
  useEffect(() => {
    const invalidate = () => {
      setPlan(null);
      setFocusSaved(false);
      setFocusMessage("");
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") invalidate();
    };
    window.addEventListener("myryra:tasks-updated", invalidate);
    window.addEventListener("focus", invalidate);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("myryra:tasks-updated", invalidate);
      window.removeEventListener("focus", invalidate);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);
  function openTaskList(filter: "pending" | "overdue") {
    sessionStorage.setItem("myryra:task-filter-pending", filter);
    navigateTo("vyra-tasks");
    window.dispatchEvent(new CustomEvent("myryra:task-filter", { detail: { filter } }));
  }
  async function prepare() {
    setLoading(true); setError(""); setPlan(null); setFocusSaved(false); setFocusMessage("");
    try {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const end = new Date(start); end.setDate(end.getDate() + 1);
      const response = await fetch("/api/mika/daily-plan", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dayStart: localIso(start), dayEnd: localIso(end) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível preparar seu dia.");
      setPlan(result.plan);
    } catch (err) { setError(err instanceof Error ? err.message : "Falha ao consultar o planejamento."); }
    finally { setLoading(false); }
  }
  async function approveFocus() {
    const focus = plan?.focusSuggestion;
    if (!focus || savingFocus || focusSaved) return;
    if (!window.confirm(`Aprovar a criação do compromisso "${focus.title}" das ${new Date(focus.startsAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} às ${new Date(focus.endsAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} na sua agenda MYRYRA?`)) return;
    setSavingFocus(true); setFocusMessage("");
    try {
      if (new Date(focus.startsAt).getTime() <= Date.now()) throw new Error("Este horário já passou. Atualize o planejamento.");
      const existing = await getCloudEvents();
      const start = Date.parse(focus.startsAt), end = Date.parse(focus.endsAt);
      if (existing.some(event => event.blocksTime && Date.parse(event.startsAt) < end && Date.parse(event.endsAt) > start)) {
        throw new Error("O horário ficou ocupado. Atualize o planejamento antes de salvar.");
      }
      if (existing.some(event => event.title === focus.title && Date.parse(event.startsAt) === start && Date.parse(event.endsAt) === end)) {
        setFocusSaved(true); setFocusMessage("Este bloco de foco já está na sua agenda."); return;
      }
      await saveCloudEvent({ title: focus.title, startsAt: focus.startsAt, endsAt: focus.endsAt, eventType: "appointment", category: "personal", blocksTime: true, notes: "Bloco de foco aprovado pelo usuário após sugestão da MIKA." });
      setFocusSaved(true); setFocusMessage("Bloco de foco salvo na sua agenda MYRYRA.");
      window.dispatchEvent(new Event("myryra:events-updated"));
    } catch (err) { setFocusMessage(err instanceof Error ? err.message : "Não foi possível salvar o foco."); }
    finally { setSavingFocus(false); }
  }
  function downloadFocusCalendar() {
    if (!plan?.focusSuggestion) return;
    const focus = plan.focusSuggestion;
    const utc = (value: string) => new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const escapeIcs = (value: string) => value.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
    const uid = `mika-focus-${utc(focus.startsAt)}@myryra.com`;
    const ics = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//MYRYRA//MIKA Focus//PT-BR", "CALSCALE:GREGORIAN",
      "BEGIN:VEVENT", `UID:${uid}`, `DTSTAMP:${utc(new Date().toISOString())}`,
      `DTSTART:${utc(focus.startsAt)}`, `DTEND:${utc(focus.endsAt)}`,
      `SUMMARY:${escapeIcs(focus.title)}`,
      "DESCRIPTION:Bloco de foco sugerido pela MIKA. Confirme a importação no seu calendário.",
      "END:VEVENT", "END:VCALENDAR", ""
    ].join("\r\n");
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = "mika-foco.ics"; anchor.click();
    URL.revokeObjectURL(url);
  }
  const formatTime = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return (
    <section className="rounded-2xl border border-violet-400/30 bg-gradient-to-br from-violet-950/50 to-slate-950 p-4 sm:p-5" aria-label="MIKA resolva meu dia">
      <div className="flex items-center gap-3">
        <img src="/myka-transparente.png" alt="" className="h-12 w-12 object-contain" />
        <div><h3 className="font-semibold text-white">MIKA, resolva meu dia</h3><p className="text-sm text-slate-300">Prioridades, conflitos e horários livres em um só lugar.</p></div>
      </div>
      <button type="button" onClick={prepare} disabled={loading} className="mt-4 rounded-xl bg-violet-500 px-4 py-2 font-semibold text-white disabled:opacity-50">
        {loading ? "Analisando seu dia..." : "Organizar meu dia"}
      </button>
      {error && <p role="alert" className="mt-3 text-sm text-rose-300">{error}</p>}
      {plan && <div className="mt-4 space-y-3 text-sm text-slate-200" aria-live="polite">
        <div className="grid grid-cols-3 gap-2">
          <button type="button" onClick={() => openTaskList("pending")} className="rounded-lg bg-white/10 p-3 text-left hover:bg-violet-500/20 focus-visible:outline-2 focus-visible:outline-violet-300" aria-label={`Abrir ${plan.pendingTasks} tarefas pendentes`}><strong className="block text-xl">{plan.pendingTasks}</strong>Tarefas pendentes <span aria-hidden="true">↗</span></button>
          <button type="button" onClick={() => navigateTo("vyra-calendar")} className="rounded-lg bg-white/10 p-3 text-left hover:bg-violet-500/20 focus-visible:outline-2 focus-visible:outline-violet-300" aria-label={`Abrir ${plan.todayEvents} compromissos`}><strong className="block text-xl">{plan.todayEvents}</strong>Compromissos <span aria-hidden="true">↗</span></button>
          <button type="button" onClick={() => openTaskList("overdue")} className="rounded-lg bg-white/10 p-3 text-left hover:bg-violet-500/20 focus-visible:outline-2 focus-visible:outline-violet-300" aria-label={`Abrir ${plan.overdueTasks} tarefas atrasadas`}><strong className="block text-xl">{plan.overdueTasks}</strong>Atrasadas <span aria-hidden="true">↗</span></button>
        </div>
        <div><h4 className="font-semibold text-white">Suas prioridades</h4>
          {plan.priorities.length ? <ul className="mt-1 list-inside list-disc">{plan.priorities.map((task, i) => <li key={i}>{task.title} ({task.priority})</li>)}</ul> : <p>Sem tarefas pendentes.</p>}
        </div>
        {plan.focusSuggestion && <div className="rounded-xl border border-violet-400/30 bg-violet-400/10 p-3"><h4 className="font-semibold text-white">Sugestão da MIKA: 25 minutos de foco</h4><p className="mt-1">{plan.focusSuggestion.title}</p><p className="text-violet-200">{formatTime(plan.focusSuggestion.startsAt)}–{formatTime(plan.focusSuggestion.endsAt)}</p><button type="button" onClick={approveFocus} disabled={savingFocus || focusSaved} className="mt-3 mr-2 rounded-lg bg-violet-500 px-3 py-2 font-semibold text-white disabled:opacity-50">{savingFocus ? "Salvando..." : focusSaved ? "Salvo na agenda" : "Aprovar e salvar na MYRYRA"}</button><button type="button" onClick={downloadFocusCalendar} className="mt-3 rounded-lg bg-violet-500 px-3 py-2 font-semibold text-white hover:bg-violet-400">Adicionar ao meu calendário (.ics)</button>{focusMessage && <p role="status" className="mt-2 text-sm text-violet-100">{focusMessage}</p>}<p className="mt-2 text-xs text-slate-300">A exportação .ics exige importação manual. O botão de aprovação salva na MYRYRA somente após sua confirmação.</p></div>}
        <div><h4 className="font-semibold text-white">Horários livres</h4>
          {plan.freeSlots.length ? <ul className="mt-1 list-inside list-disc">{plan.freeSlots.slice(0, 3).map((slot, i) => <li key={i}>{formatTime(slot.startsAt)}–{formatTime(slot.endsAt)} ({slot.minutes} min)</li>)}</ul> : <p>Nenhum intervalo livre identificado no restante do dia.</p>}
        </div>
        {plan.conflicts.length > 0 && <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-3"><h4 className="font-semibold text-amber-200">{plan.conflicts.length} conflito(s) na agenda</h4><ul className="mt-1 list-inside list-disc text-amber-100">{plan.conflicts.slice(0, 3).map((item, i) => <li key={i}>{item.first} × {item.second}</li>)}</ul></div>}
        <div className="flex flex-wrap gap-2"><a href="#vyra-tasks" className="rounded-lg border border-violet-400/50 px-3 py-2 text-violet-100 hover:bg-violet-400/10">Revisar tarefas</a><a href="#vyra-calendar" className="rounded-lg border border-white/20 px-3 py-2 text-white hover:bg-white/10">Abrir agenda</a></div>
        <p className="text-xs text-slate-400">A análise não altera seus dados. A criação do bloco de foco depende de sua aprovação explícita.</p>
      </div>}
    </section>
  );
}
