"use client";

import { useEffect, useState } from "react";

type Goal = { id: string; title: string; target: number; progress: number };
const MAX_GOALS = 8;

export default function QuickGoals({ userId }: { userId: string }) {
  const storageKey = `myryra:quick-goals:v1:${userId}`;
  const [goals, setGoals] = useState<Goal[]>([]);
  const [ready, setReady] = useState(false);
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState(5);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(storageKey) || "[]");
      if (Array.isArray(stored)) setGoals(stored.filter((g): g is Goal => !!g && typeof g.id === "string" && typeof g.title === "string" && Number.isInteger(g.target) && g.target > 0 && Number.isInteger(g.progress) && g.progress >= 0).slice(0, MAX_GOALS));
    } catch { /* Invalid or disabled browser storage. */ }
    setReady(true);
  }, [storageKey]);

  function persist(next: Goal[]) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
      setGoals(next);
      setError("");
    } catch { setError("O navegador não permitiu salvar as metas. Verifique o armazenamento local."); }
  }

  function add(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || goals.length >= MAX_GOALS || !title.trim() || title.trim().length > 120 || !Number.isInteger(target) || target < 1 || target > 100) return;
    persist([...goals, { id: crypto.randomUUID(), title: title.trim(), target, progress: 0 }]);
    setTitle("");
  }

  return <section className="rounded-2xl border border-violet-500/30 bg-slate-900 p-5 text-white" aria-label="Metas rápidas">
    <p className="text-xs font-semibold uppercase tracking-widest text-violet-400">MYRYRA · METAS RÁPIDAS</p>
    <h3 className="mt-2 text-xl font-semibold">Pequenas conquistas, grandes resultados.</h3>
    <p className="mt-1 text-sm text-slate-300">Defina uma meta mensurável e acompanhe seu progresso. Até {MAX_GOALS} metas por navegador.</p>
    <form onSubmit={add} className="mt-4 flex flex-wrap gap-2">
      <input aria-label="Nome da meta" value={title} onChange={e => setTitle(e.target.value)} maxLength={120} required placeholder="Ex.: Estudar italiano" className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm" />
      <label className="flex items-center gap-2 text-sm text-slate-300">Alvo <input type="number" min={1} max={100} value={target} onChange={e => setTarget(Number(e.target.value))} className="w-20 rounded-xl border border-slate-700 bg-slate-950 p-3 text-white" /></label>
      <button type="submit" disabled={!ready || goals.length >= MAX_GOALS || !title.trim()} className="rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold disabled:opacity-50">Criar meta</button>
    </form>
    <ul className="mt-4 space-y-3">{goals.map(goal => <li key={goal.id} className="rounded-xl border border-slate-700 p-3">
      <div className="flex items-center justify-between gap-2"><span className="min-w-0 truncate text-sm font-medium">{goal.title}</span><button type="button" onClick={() => persist(goals.filter(g => g.id !== goal.id))} className="text-xs text-slate-400 hover:text-rose-300" aria-label={`Excluir meta ${goal.title}`}>Excluir</button></div>
      <p className="mt-1 text-xs text-slate-400">{Math.min(goal.progress, goal.target)} / {goal.target} · {Math.round(Math.min(goal.progress / goal.target, 1) * 100)}%</p>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-700"><div className="h-full rounded-full bg-violet-500" style={{ width: `${Math.min(goal.progress / goal.target, 1) * 100}%` }} /></div>
      <div className="mt-3 flex gap-2"><button type="button" disabled={goal.progress <= 0} onClick={() => persist(goals.map(g => g.id === goal.id ? { ...g, progress: Math.max(0, g.progress - 1) } : g))} className="rounded-lg border border-slate-700 px-3 py-1 text-sm disabled:opacity-40">−1</button><button type="button" disabled={goal.progress >= goal.target} onClick={() => persist(goals.map(g => g.id === goal.id ? { ...g, progress: Math.min(g.target, g.progress + 1) } : g))} className="rounded-lg border border-violet-500 px-3 py-1 text-sm text-violet-200 disabled:opacity-40">+1</button></div>
    </li>)}</ul>
    {error && <p role="alert" className="mt-3 text-sm text-rose-300">{error}</p>}
    <p className="mt-3 text-xs text-slate-400">Versão inicial: progresso manual, armazenado apenas neste navegador. Sincronização entre dispositivos será uma evolução posterior.</p>
  </section>;
}
