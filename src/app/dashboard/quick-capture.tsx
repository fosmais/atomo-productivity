"use client";
import FeatureHint from "./feature-hint";

import { useRef, useState } from "react";
import { saveCloudPlan } from "@/lib/plan-cloud";
import { saveCloudEvent } from "@/lib/event-cloud";

type Draft = { id: string; title: string; priority: "Alta" | "Média" | "Normal"; selected: boolean; dueDate: string | null };

function localDate(offsetDays: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function extractDate(title: string): { title: string; dueDate: string | null } {
  const relative = /(^|[\s,;])(hoje|amanhã|amanha)(?=$|[\s,;.!?])/i.exec(title);
  if (relative) {
    return { title: title.replace(relative[0], relative[1] || "").replace(/\s+/g, " ").trim().replace(/[,.]$/, ""), dueDate: localDate(/^hoje$/i.test(relative[2]) ? 0 : 1) };
  }
  const explicit = /\b(\d{2})\/(\d{2})\/(\d{4})\b/.exec(title);
  if (explicit) {
    const candidate = `${explicit[3]}-${explicit[2]}-${explicit[1]}`;
    const date = new Date(candidate + "T00:00:00Z");
    if (Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === candidate) {
      return { title: title.replace(explicit[0], "").replace(/\s+/g, " ").trim().replace(/[,.]$/, ""), dueDate: candidate };
    }
  }
  return { title, dueDate: null };
}

function parseDrafts(text: string): Draft[] {
  const seen = new Set<string>();
  return text.split(/[\n;]+/).map((part) => part.trim().replace(/^[\s\-•*\d.)]+/, "").trim())
    .filter((title) => {
      if (!title || title.length > 200) return false;
      const key = title.toLocaleLowerCase("pt-BR");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 10).map((title) => ({
      id: crypto.randomUUID(), ...extractDate(title), priority: "Normal" as const, selected: true,
    }));
}

export default function QuickCapture() {
  const [input, setInput] = useState("");
  const [captureType, setCaptureType] = useState<"task" | "event">("task");
  const [eventStart, setEventStart] = useState("");
  const [eventEnd, setEventEnd] = useState("");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function saveQuickEvent() {
    if (savingRef.current) return;
    if (!input.trim() || !eventStart || !eventEnd || new Date(eventEnd).getTime() <= new Date(eventStart).getTime()) {
      setError("Informe título, início e término válidos para o compromisso.");
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await saveCloudEvent({ title: input.trim(), startsAt: eventStart, endsAt: eventEnd, eventType: "appointment", blocksTime: true });
      window.dispatchEvent(new Event("myryra:events-updated"));
      setInput("");
      setEventStart("");
      setEventEnd("");
      setSuccess("Compromisso salvo na agenda MYRYRA.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar o compromisso.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }
  function prepare() {
    setError("");
    setSuccess("");
    const parsed = parseDrafts(input);
    if (!parsed.length) {
      setError("Escreva uma tarefa por linha ou separe por ponto e vírgula (máximo de 200 caracteres por tarefa).");
      return;
    }
    setDrafts(parsed);
  }

  async function confirm() {
    const selected = drafts.filter((draft) => draft.selected && draft.title.trim());
    if (!selected.length || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await saveCloudPlan("Captura rápida", selected.map((draft) => ({
        id: crypto.randomUUID(),
        title: draft.title.trim(),
        priority: draft.priority,
        dueDate: draft.dueDate,
        completed: false,
      })));
      window.dispatchEvent(new Event("myryra:tasks-updated"));
      setSuccess(`${selected.length} tarefa(s) salva(s) e adicionada(s) à lista.`);
      setDrafts([]);
      setInput("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar as tarefas.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-violet-500/30 bg-slate-900 p-5 text-white" aria-label="Captura rápida">
      <FeatureHint label="MYRYRA · CAPTURA RÁPIDA" title="Tire as ideias da cabeça" description="Transforma anotações em tarefas, reconhecendo datas como hoje, amanhã ou 31/10/2026." tip="Revise os dados e confirme antes de salvar." />
      <h3 className="mt-2 text-xl font-semibold">Tire as ideias da cabeça.</h3>
      <div className="mt-3 flex gap-2" role="group" aria-label="Tipo de captura">
        <button type="button" onClick={() => { setCaptureType("task"); setDrafts([]); setError(""); }} className={`rounded-lg px-4 py-2 text-sm font-medium ${captureType === "task" ? "bg-violet-600 text-white" : "border border-slate-600 text-slate-300"}`}>Tarefa</button>
        <button type="button" onClick={() => { setCaptureType("event"); setDrafts([]); setError(""); }} className={`rounded-lg px-4 py-2 text-sm font-medium ${captureType === "event" ? "bg-violet-600 text-white" : "border border-slate-600 text-slate-300"}`}>Compromisso</button>
      </div>
      <p className="mt-2 text-sm text-slate-300">{captureType === "task" ? "Uma tarefa por linha. Reconhece hoje, amanhã e DD/MM/AAAA." : "Registre um compromisso diretamente na agenda MYRYRA."}</p>
      <label htmlFor="quick-capture-input" className="sr-only">Tarefas para organizar</label>
      <textarea id="quick-capture-input" value={input} onChange={(event) => { setInput(event.target.value); setDrafts([]); setSuccess(""); }}
        maxLength={2200} rows={4} placeholder={"Preparar reunião de terça\nPagar escola\nMarcar dentista"}
        className="mt-4 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white placeholder:text-slate-500" />
      {captureType === "event" && <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-sm text-slate-300">Início<input type="datetime-local" value={eventStart} onChange={event => setEventStart(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-white" /></label>
        <label className="text-sm text-slate-300">Término<input type="datetime-local" value={eventEnd} onChange={event => setEventEnd(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-white" /></label>
      </div>}
      <button type="button" onClick={captureType === "task" ? prepare : () => void saveQuickEvent()} disabled={!input.trim() || saving}
        className="mt-3 rounded-xl border border-violet-500 px-4 py-2 font-semibold text-violet-200 hover:bg-violet-900/30 disabled:opacity-50">
        {captureType === "task" ? "Revisar tarefas" : saving ? "Salvando..." : "Salvar compromisso"}
      </button>
      {captureType === "task" && drafts.length > 0 && (
        <div className="mt-4 space-y-3">
          <p className="text-sm font-medium text-violet-200">Confira e escolha o que salvar:</p>
          {drafts.map((draft) => (
            <div key={draft.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-700 p-3">
              <input aria-label={`Selecionar ${draft.title}`} type="checkbox" checked={draft.selected}
                onChange={(event) => setDrafts((items) => items.map((item) => item.id === draft.id ? { ...item, selected: event.target.checked } : item))} />
              <input aria-label="Editar título da tarefa" value={draft.title} maxLength={200}
                onChange={(event) => setDrafts((items) => items.map((item) => item.id === draft.id ? { ...item, title: event.target.value } : item))}
                className="min-w-0 basis-full flex-1 rounded-lg sm:basis-auto border border-slate-700 bg-slate-950 p-2 text-sm" />
              <label className="text-xs text-slate-300">Prazo <input aria-label={`Prazo de ${draft.title}`} type="date" value={draft.dueDate ?? ""} onChange={event => setDrafts(items => items.map(item => item.id === draft.id ? { ...item, dueDate: event.target.value || null } : item))} className="ml-2 rounded-lg border border-slate-700 bg-slate-950 p-2 text-sm text-white" /></label>
              <select aria-label={`Prioridade de ${draft.title}`} value={draft.priority}
                onChange={(event) => setDrafts((items) => items.map((item) => item.id === draft.id ? { ...item, priority: event.target.value as Draft["priority"] } : item))}
                className="max-w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-sm">
                <option value="Normal">Normal</option><option value="Média">Média</option><option value="Alta">Alta</option>
              </select>
            </div>
          ))}
          <button type="button" disabled={saving || !drafts.some((draft) => draft.selected && draft.title.trim())}
            onClick={() => void confirm()}
            className="rounded-xl bg-violet-600 px-5 py-3 font-semibold text-white hover:bg-violet-500 disabled:opacity-50">
            {saving ? "Salvando..." : "Confirmar e salvar selecionadas"}
          </button>
        </div>
      )}
      {error && <p role="alert" className="mt-3 text-sm text-rose-300">{error}</p>}
      {success && <p role="status" className="mt-3 text-sm text-emerald-300">{success}</p>}
      <p className="mt-3 text-xs text-slate-400">Até 10 tarefas por captura. Reconhecimento local de datas, sem chamada adicional à IA.</p>
    </section>
  );
}
