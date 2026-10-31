"use client";

import { useEffect, useState } from "react";

const steps = [
  { label: "Criar sua primeira tarefa", target: "vyra-tasks" },
  { label: "Organizar a agenda", target: "vyra-calendar" },
  { label: "Conversar com a MYKA", target: "vyra-ai" },
  { label: "Conhecer o Meu Dia", target: "vyra-planner" },
];

export default function FirstSteps({ userId }: { userId: string }) {
  const [done, setDone] = useState<number[]>([]);
  const [dismissed, setDismissed] = useState(true);
  const storageKey = `myryra:onboarding:v1:${userId}`;
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "{}") as { done?: number[]; dismissed?: boolean };
      setDone(Array.isArray(saved.done) ? saved.done.filter((i): i is number => Number.isInteger(i) && i >= 0 && i < steps.length) : []);
      setDismissed(saved.dismissed === true);
    } catch { setDone([]); setDismissed(false); }
  }, [storageKey]);
  function persist(nextDone: number[], nextDismissed: boolean) {
    setDone(nextDone);
    setDismissed(nextDismissed);
    try { localStorage.setItem(storageKey, JSON.stringify({ done: nextDone, dismissed: nextDismissed })); } catch { /* Browser storage may be disabled. */ }
  }
  if (dismissed || done.length === steps.length) return null;
  return <section className="rounded-2xl border border-violet-500/30 bg-slate-900 p-5 text-white" aria-label="Primeiros passos">
    <div className="flex items-start justify-between gap-3">
      <div><p className="text-xs font-semibold uppercase tracking-widest text-violet-400">BEM-VINDO À MYRYRA</p><h3 className="mt-2 text-xl font-semibold">Sua rotina começa aqui.</h3><p className="mt-1 text-sm text-slate-300">{done.length} de {steps.length} passos explorados</p></div>
      <button type="button" onClick={() => persist(done, true)} className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300">Dispensar</button>
    </div>
    <ol className="mt-4 grid gap-2 sm:grid-cols-2">{steps.map((step, index) => <li key={step.target} className="flex items-center gap-3 rounded-xl border border-slate-700 p-3">
      <input type="checkbox" aria-label={`Marcar ${step.label} como explorado`} checked={done.includes(index)} onChange={event => persist(event.target.checked ? [...done, index] : done.filter(i => i !== index), false)} />
      <button type="button" onClick={() => document.getElementById(step.target)?.scrollIntoView({ behavior: "smooth" })} className="text-left text-sm text-violet-200 hover:underline">{step.label}</button>
    </li>)}</ol>
    <p className="mt-3 text-xs text-slate-400">Marque os passos conforme explorar. Este guia é salvo apenas neste navegador.</p>
  </section>;
}
