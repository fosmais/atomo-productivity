"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Category = "weight" | "workout" | "meal" | "sleep" | "meditation";
type Log = { id: string; category: Category; occurred_on: string; value: number | null; unit: string | null; notes: string };
const options: { id: Category; title: string; unit: string | null; placeholder: string }[] = [
  { id: "weight", title: "Peso", unit: "kg", placeholder: "Peso em kg" },
  { id: "workout", title: "Treino", unit: "minutes", placeholder: "Duração em minutos" },
  { id: "meal", title: "Alimentação", unit: null, placeholder: "Descreva a refeição" },
  { id: "sleep", title: "Sono", unit: "hours", placeholder: "Horas dormidas" },
  { id: "meditation", title: "Meditação", unit: "minutes", placeholder: "Duração em minutos" }
];
const today = () => { const now = new Date(); return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-"); };
export default function HealthDailyLog() {
  const [category, setCategory] = useState<Category>("weight");
  const [date, setDate] = useState(today);
  const [value, setValue] = useState("");
  const [notes, setNotes] = useState("");
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function refresh() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setMessage("Entre na sua conta para acompanhar os registros."); setLoading(false); return; }
    const { data, error } = await supabase.from("myryra_health_logs").select("id,category,occurred_on,value,unit,notes").eq("user_id", user.id).order("occurred_on", { ascending: false }).limit(40);
    if (error) setMessage("Não foi possível carregar seu histórico.");
    else setLogs((data || []) as Log[]);
    setLoading(false);
  }
  useEffect(() => { void refresh(); }, []);
  const selected = options.find(item => item.id === category)!;
  async function save() {
    const number = selected.unit ? Number(value.replace(",", ".")) : null;
    if (selected.unit && (!value.trim() || !Number.isFinite(number) || number === null || number <= 0 || number > 10000)) { setMessage("Informe um valor positivo válido."); return; }
    if (category === "weight" && number !== null && number > 700) { setMessage("Confira o peso informado."); return; }
    if (category === "sleep" && number !== null && number > 24) { setMessage("Informe até 24 horas de sono."); return; }
    if (category === "meal" && !notes.trim()) { setMessage("Descreva a refeição."); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) || date > today()) { setMessage("Escolha uma data válida, até hoje."); return; }
    setBusy(true); setMessage("");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setBusy(false); setMessage("Entre na sua conta."); return; }
    const { error } = await supabase.from("myryra_health_logs").insert({ user_id: user.id, category, occurred_on: date, value: number, unit: selected.unit, notes: notes.trim() });
    setBusy(false);
    if (error) { setMessage("Não foi possível salvar. Tente novamente."); return; }
    setValue(""); setNotes(""); setMessage("Registro salvo."); await refresh(); window.dispatchEvent(new Event("myryra:health:changed"));
  }
  async function remove(id: string) {
    if (!window.confirm("Excluir este registro?")) return;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("myryra_health_logs").delete().eq("id", id).eq("user_id", user.id);
    if (error) setMessage("Não foi possível excluir.");
    else { setMessage("Registro excluído."); await refresh(); window.dispatchEvent(new Event("myryra:health:changed")); }
  }
  return <section className="space-y-4 rounded-2xl border border-white/10 bg-slate-950/40 p-4 sm:p-5">
    <div><h3 className="text-lg font-semibold text-white">Diário de bem-estar</h3><p className="mt-1 text-sm text-slate-300">Registre seus hábitos no seu ritmo. Seu histórico é privado e você pode excluir qualquer lançamento.</p></div>
    <div className="flex flex-wrap gap-2">{options.map(item => <button key={item.id} type="button" onClick={() => {setCategory(item.id);setValue("");setNotes("");setMessage("");}} aria-pressed={category === item.id} className={"rounded-xl border px-3 py-2 text-sm " + (category === item.id ? "border-violet-400 bg-violet-600/25 text-white" : "border-white/15 text-slate-300")}>{item.title}</button>)}</div>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="text-sm text-slate-200">Data<input type="date" max={today()} value={date} onChange={e => setDate(e.target.value)} className="mt-1 w-full rounded-xl border border-white/20 bg-slate-900 p-3 text-white" /></label>
      {selected.unit && <label className="text-sm text-slate-200">{selected.placeholder}<input type="number" min="0.1" max={category === "sleep" ? 24 : category === "weight" ? 700 : 10000} step={category === "weight" || category === "sleep" ? "0.1" : "1"} value={value} onChange={e => setValue(e.target.value)} placeholder={selected.placeholder} className="mt-1 w-full rounded-xl border border-white/20 bg-slate-900 p-3 text-white" /></label>}
    </div>
    <label className="block text-sm text-slate-200">{category === "meal" ? "Refeição" : "Observações (opcional)"}<textarea maxLength={500} rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder={category === "meal" ? "Ex.: almoço, arroz, feijão e legumes" : "Como foi sua experiência?"} className="mt-1 w-full rounded-xl border border-white/20 bg-slate-900 p-3 text-white placeholder:text-slate-500" /></label>
    <button type="button" disabled={busy} onClick={() => void save()} className="rounded-xl bg-violet-600 px-4 py-3 font-semibold text-white disabled:opacity-50">{busy ? "Salvando..." : "Adicionar registro"}</button>
    {message && <p role="status" className="text-sm text-violet-200">{message}</p>}
    <div className="border-t border-white/10 pt-4"><h4 className="font-semibold text-white">Histórico recente</h4>
      {loading ? <p className="mt-2 text-sm text-slate-400">Carregando...</p> : logs.length === 0 ? <p className="mt-2 text-sm text-slate-400">Nenhum registro ainda.</p> : <div className="mt-3 space-y-2">{logs.map(log => <div key={log.id} className="flex items-start justify-between gap-3 rounded-xl border border-white/10 bg-slate-900/60 p-3"><div className="min-w-0"><p className="text-sm font-semibold text-white">{options.find(o => o.id === log.category)?.title || log.category} · {log.occurred_on.split("-").reverse().join("/")}{log.value !== null ? " · " + log.value + " " + (log.unit === "kg" ? "kg" : log.unit === "hours" ? "h" : "min") : ""}</p>{log.notes && <p className="mt-1 break-words text-sm text-slate-300">{log.notes}</p>}</div><button type="button" onClick={() => void remove(log.id)} className="shrink-0 text-xs text-rose-300 hover:underline">Excluir</button></div>)}</div>}
    </div>
  </section>;
}
