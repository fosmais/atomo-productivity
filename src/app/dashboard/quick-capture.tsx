"use client";

import { useState } from "react";
import { saveCloudPlan } from "@/lib/plan-cloud";

type Draft = { id: string; title: string; priority: "Alta" | "Média" | "Normal"; selected: boolean };

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
      id: crypto.randomUUID(), title, priority: "Normal" as const, selected: true,
    }));
}

export default function QuickCapture() {
  const [input, setInput] = useState("");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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
    if (!selected.length || saving) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await saveCloudPlan("Captura rápida", selected.map((draft) => ({
        id: crypto.randomUUID(),
        title: draft.title.trim(),
        priority: draft.priority,
        dueDate: null,
        completed: false,
      })));
      window.dispatchEvent(new Event("myryra:tasks-updated"));
      setSuccess(`${selected.length} tarefa(s) salva(s) e adicionada(s) à lista.`);
      setDrafts([]);
      setInput("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar as tarefas.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-violet-500/30 bg-slate-900 p-5 text-white" aria-label="Captura rápida">
      <p className="text-xs font-semibold uppercase tracking-widest text-violet-400">MYRYRA · CAPTURA RÁPIDA</p>
      <h3 className="mt-2 text-xl font-semibold">Tire as ideias da cabeça.</h3>
      <p className="mt-1 text-sm text-slate-300">Uma tarefa por linha ou separadas por ponto e vírgula. Revise antes de salvar.</p>
      <label htmlFor="quick-capture-input" className="sr-only">Tarefas para organizar</label>
      <textarea id="quick-capture-input" value={input} onChange={(event) => { setInput(event.target.value); setDrafts([]); setSuccess(""); }}
        maxLength={2200} rows={4} placeholder={"Preparar reunião de terça\nPagar escola\nMarcar dentista"}
        className="mt-4 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white placeholder:text-slate-500" />
      <button type="button" onClick={prepare} disabled={!input.trim() || saving}
        className="mt-3 rounded-xl border border-violet-500 px-4 py-2 font-semibold text-violet-200 hover:bg-violet-900/30 disabled:opacity-50">
        Revisar tarefas
      </button>
      {drafts.length > 0 && (
        <div className="mt-4 space-y-3">
          <p className="text-sm font-medium text-violet-200">Confira e escolha o que salvar:</p>
          {drafts.map((draft) => (
            <div key={draft.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-700 p-3">
              <input aria-label={`Selecionar ${draft.title}`} type="checkbox" checked={draft.selected}
                onChange={(event) => setDrafts((items) => items.map((item) => item.id === draft.id ? { ...item, selected: event.target.checked } : item))} />
              <input aria-label="Editar título da tarefa" value={draft.title} maxLength={200}
                onChange={(event) => setDrafts((items) => items.map((item) => item.id === draft.id ? { ...item, title: event.target.value } : item))}
                className="min-w-[150px] flex-1 rounded-lg border border-slate-700 bg-slate-950 p-2 text-sm" />
              <select aria-label={`Prioridade de ${draft.title}`} value={draft.priority}
                onChange={(event) => setDrafts((items) => items.map((item) => item.id === draft.id ? { ...item, priority: event.target.value as Draft["priority"] } : item))}
                className="rounded-lg border border-slate-700 bg-slate-950 p-2 text-sm">
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
      <p className="mt-3 text-xs text-slate-400">Até 10 tarefas por captura. Organização por linhas, sem chamada de IA nesta primeira versão.</p>
    </section>
  );
}
