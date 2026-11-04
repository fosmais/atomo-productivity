"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Row = { description: string; amount_cents: number; kind: "income" | "expense" };
function parseCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = []; let field = ""; let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') { if (quoted && line[i + 1] === '"') { field += '"'; i++; } else quoted = !quoted; }
    else if (char === delimiter && !quoted) { result.push(field.trim()); field = ""; }
    else field += char;
  }
  result.push(field.trim()); return result;
}
function parseMoney(value: string): number | null {
  let raw = value.replace(/R\$/gi, "").replace(/\s/g, "");
  if (raw.includes(",") && raw.includes(".")) raw = raw.lastIndexOf(",") > raw.lastIndexOf(".") ? raw.replace(/\./g, "").replace(",", ".") : raw.replace(/,/g, "");
  else if (raw.includes(",")) raw = raw.replace(",", ".");
  if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) return null;
  const cents = Math.round(Number(raw) * 100);
  return Number.isSafeInteger(cents) && cents > 0 && cents <= 1e11 ? cents : null;
}
export default function FinanceCsvImport() {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState("");
  async function selectFile(file?: File) {
    setRows([]); setError(""); setDone("");
    if (!file) return;
    if (file.size > 1024 * 1024 || !/\.csv$/i.test(file.name)) { setError("Selecione um CSV de até 1 MB."); return; }
    const text = (await file.text()).replace(/^\uFEFF/, "");
    const lines = text.split(/\r?\n/).filter(line => line.trim());
    if (lines.length < 2 || lines.length > 501) { setError("O CSV deve ter cabeçalho e até 500 lançamentos."); return; }
    const delimiter = lines[0].includes(";") ? ";" : ",";
    const headers = parseCsvLine(lines[0], delimiter).map(v => v.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
    const find = (...names: string[]) => headers.findIndex(h => names.includes(h));
    const description = find("descricao", "description", "historico");
    const amount = find("valor", "amount");
    const type = find("tipo", "type", "natureza");
    if ([description, amount, type].some(i => i < 0)) { setError("Cabeçalhos obrigatórios: descrição;valor;tipo (receita ou despesa)."); return; }
    const parsed: Row[] = [];
    for (let index = 1; index < lines.length; index++) {
      const values = parseCsvLine(lines[index], delimiter);
      const name = values[description]?.trim();
      const cents = parseMoney(values[amount] ?? "");
      const kindText = (values[type] ?? "").trim().toLowerCase();
      const kind = ["receita", "entrada", "income"].includes(kindText) ? "income" : ["despesa", "saida", "saída", "expense"].includes(kindText) ? "expense" : null;
      if (!name || name.length > 100 || cents === null || !kind) { setError(`Linha ${index + 1} inválida. Confira descrição, valor e tipo.`); return; }
      parsed.push({ description: name, amount_cents: cents, kind });
    }
    setRows(parsed);
  }
  async function confirm() {
    if (!rows.length || busy) return;
    setBusy(true); setError("");
    try {
      const client = createClient();
      const { data: auth, error: authError } = await client.auth.getUser();
      if (authError || !auth.user) throw new Error("Faça login novamente.");
      const { error: insertError } = await client.from("myryra_finance_entries").insert(rows.map(row => ({ ...row, user_id: auth.user.id })));
      if (insertError) throw insertError;
      setDone(`${rows.length} lançamentos importados. Atualize a visão geral para conferir.`);
      setRows([]);
      window.dispatchEvent(new Event("myryra:finance-updated"));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao importar os lançamentos."); }
    finally { setBusy(false); }
  }
  return <section className="rounded-2xl border border-white/15 bg-slate-900/75 p-4 text-white">
    <h3 className="font-semibold">Importar planilha de despesas</h3>
    <p className="mt-1 text-sm text-slate-400">Importe um CSV exportado do Excel. Colunas: descrição;valor;tipo. Tipos: receita ou despesa. Revise antes de confirmar; cada importação adiciona lançamentos.</p>
    <input type="file" accept=".csv,text/csv" aria-label="Selecionar planilha CSV" onChange={e => void selectFile(e.target.files?.[0])} className="mt-3 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-violet-600 file:px-3 file:py-2 file:text-white" />
    {rows.length > 0 && <div className="mt-3 space-y-2"><p className="text-sm text-violet-200">{rows.length} lançamentos prontos para importar</p>
      <div className="max-h-48 overflow-auto rounded-lg border border-white/10 p-2 text-xs">{rows.slice(0, 15).map((row, i) => <p key={i} className="py-1">{row.description} · {row.kind === "income" ? "Receita" : "Despesa"} · {(row.amount_cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>)}{rows.length > 15 && <p>Mais {rows.length - 15} lançamentos...</p>}</div>
      <button type="button" disabled={busy} onClick={() => void confirm()} className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold disabled:opacity-50">{busy ? "Importando..." : "Confirmar importação"}</button>
    </div>}
    {error && <p role="alert" className="mt-2 text-sm text-red-300">{error}</p>}
    {done && <p role="status" className="mt-2 text-sm text-emerald-300">{done}</p>}
  </section>;
}
