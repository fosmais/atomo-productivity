"use client";

import { useState } from "react";
import { getCloudPlans, saveCloudPlan } from "@/lib/plan-cloud";
import type { SavedTask } from "@/lib/plan-storage";

function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = "", quoted = false;
  const text = input.replace(/^\uFEFF/, "");
  const headerLine = text.split(/\r?\n/, 1)[0];
  const delimiter = (headerLine.match(/;/g) ?? []).length > (headerLine.match(/,/g) ?? []).length ? ";" : ",";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (quoted && text[i + 1] === '"') { field += '"'; i++; }
      else if (!field || quoted) quoted = !quoted;
      else throw new Error("CSV com aspas inválidas.");
    } else if (ch === delimiter && !quoted) { row.push(field); field = ""; }
    else if ((ch === "\n" || ch === "\r") && !quoted) {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      if (row.some(v => v.trim())) rows.push(row);
      row = []; field = "";
    } else field += ch;
  }
  if (quoted) throw new Error("CSV com aspas não fechadas.");
  row.push(field);
  if (row.some(v => v.trim())) rows.push(row);
  return rows;
}

function parseTasks(input: string): SavedTask[] {
  const rows = parseCsv(input);
  if (rows.length < 2) throw new Error("Inclua um cabeçalho e pelo menos uma tarefa.");
  const headers = rows[0].map(v => v.trim().toLowerCase());
  const normalizeDate = (raw: string): string | null => {
    if (!raw) return null;
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
    if (!match) return null;
    const [, year, month, day] = match;
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    return date.getUTCFullYear() === Number(year) && date.getUTCMonth() + 1 === Number(month) && date.getUTCDate() === Number(day) ? `${year}-${month}-${day}` : null;
  };
  const titleColumn = headers.findIndex(v => ["title", "título", "titulo", "task", "content", "tarefa"].includes(v));
  if (titleColumn < 0) throw new Error("O CSV precisa de uma coluna title, content ou título.");
  const priorityColumn = headers.findIndex(v => ["priority", "prioridade"].includes(v));
  const dateColumn = headers.findIndex(v => ["due_date", "due date", "due", "date", "prazo", "data"].includes(v));
  const typeColumn = headers.findIndex(v => v === "type");
  const seen = new Set<string>();
  const tasks: SavedTask[] = [];
  for (const row of rows.slice(1)) {
    if (typeColumn >= 0 && ["section", "note"].includes((row[typeColumn] ?? "").trim().toLowerCase())) continue;
    const title = (row[titleColumn] ?? "").trim();
    if (!title) continue;
    if (title.length > 200) throw new Error("Há títulos com mais de 200 caracteres.");
    const rawPriority = (row[priorityColumn] ?? "").trim().toLowerCase();
    const priority: "Alta" | "Média" | "Normal" = ["alta", "high", "p1", "4"].includes(rawPriority) ? "Alta" : ["média", "media", "medium", "p2", "3"].includes(rawPriority) ? "Média" : "Normal";
    const rawDate = (row[dateColumn] ?? "").trim();
    const dueDate = normalizeDate(rawDate);
    if (rawDate && !dueDate) throw new Error(`Prazo inválido para a tarefa "${title}". Use AAAA-MM-DD.`);
    const key = title.toLocaleLowerCase("pt-BR") + "|" + (dueDate ?? "");
    if (seen.has(key)) continue;
    seen.add(key);
    tasks.push({ id: crypto.randomUUID(), title, priority, dueDate, completed: false });
    if (tasks.length > 200) throw new Error("Importe até 200 tarefas por arquivo.");
  }
  if (!tasks.length) throw new Error("Nenhuma tarefa válida encontrada.");
  return tasks;
}

export default function ManualTaskImport() {
  const [tasks, setTasks] = useState<SavedTask[]>([]);
  const [filename, setFilename] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  async function readFile(file?: File) {
    setError(""); setMessage(""); setTasks([]); setFilename(""); setConfirmed(false);
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv") || file.size > 1024 * 1024) {
      setError("Selecione um arquivo CSV de até 1 MB."); return;
    }
    try {
      const parsed = parseTasks(await file.text());
      setTasks(parsed); setFilename(file.name);
    } catch (err) { setError(err instanceof Error ? err.message : "Não foi possível ler o CSV."); }
  }

  async function importTasks() {
    if (busy || !tasks.length || !confirmed) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const existingPlans = await getCloudPlans();
      const existingKeys = new Set(existingPlans.flatMap(plan => plan.tasks.map(task => task.title.trim().toLocaleLowerCase("pt-BR") + "|" + (task.dueDate ?? ""))));
      const newTasks = tasks.filter(task => !existingKeys.has(task.title.trim().toLocaleLowerCase("pt-BR") + "|" + (task.dueDate ?? "")));
      if (!newTasks.length) {
        setMessage("Todas as tarefas deste arquivo já existem na MYRYRA. Nenhuma duplicata foi criada.");
        setTasks([]); setFilename(""); setConfirmed(false); return;
      }
      await saveCloudPlan("Importação manual · " + filename.slice(0, 100), newTasks);
      setMessage(newTasks.length + " tarefa(s) importada(s) para a MYRYRA." + (tasks.length > newTasks.length ? " " + (tasks.length - newTasks.length) + " duplicata(s) ignorada(s)." : ""));
      setTasks([]); setFilename(""); setConfirmed(false);
      window.dispatchEvent(new Event("myryra:tasks-updated"));
    } catch (err) { setError(err instanceof Error ? err.message : "Falha ao importar."); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-3 rounded-2xl border border-violet-400/20 bg-slate-950/50 p-4">
      <h3 className="text-base font-semibold text-white">Importação manual de tarefas · CSV</h3>
      <p className="text-sm text-slate-300">Exporte suas tarefas em CSV e confira a prévia antes de salvar. Esta etapa não conecta contas externas e não sincroniza alterações futuras.</p>
      <p className="text-xs text-slate-400">Colunas aceitas: title ou content (obrigatória), priority e due_date (AAAA-MM-DD). Arquivos até 1 MB e 200 tarefas. Separadores aceitos: vírgula e ponto e vírgula.</p>
      <input type="file" accept=".csv,text/csv" aria-label="Selecionar CSV de tarefas" disabled={busy} onChange={event => void readFile(event.target.files?.[0])} className="block w-full text-sm text-slate-200 file:mr-3 file:rounded-lg file:border-0 file:bg-violet-600 file:px-3 file:py-2 file:text-white" />
      <a download="myryra-modelo-tarefas.csv" href={"data:text/csv;charset=utf-8," + encodeURIComponent("title,priority,due_date\nRevisar planejamento,Alta,2026-11-05\nOrganizar documentos,Normal,")} className="inline-block text-sm font-medium text-violet-300 underline underline-offset-4">Baixar modelo CSV</a>
      {tasks.length > 0 && <div className="space-y-3">
        <p className="text-sm text-violet-200">{tasks.length} tarefa(s) pronta(s) para importar de {filename}.</p>
        <ul className="max-h-48 space-y-1 overflow-y-auto text-sm text-slate-300">{tasks.slice(0, 12).map(task => <li key={task.id} className="rounded-lg bg-slate-900 px-3 py-2">{task.title}</li>)}</ul>
        {tasks.length > 12 && <p className="text-xs text-slate-400">Mais {tasks.length - 12} tarefas não exibidas na prévia.</p>}
        <label className="flex items-start gap-2 text-sm text-slate-200"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} disabled={busy} className="mt-1 accent-violet-500" /> Conferi a prévia e autorizo adicionar estas tarefas à minha conta.</label>
        <button type="button" disabled={busy || !confirmed} onClick={() => void importTasks()} className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Importando..." : "Confirmar importação"}</button>
      </div>}
      {message && <p role="status" className="text-sm text-emerald-300">{message}</p>}
      {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
    </div>
  );
}
