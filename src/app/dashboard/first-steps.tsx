"use client";

import { useEffect, useState } from "react";
import { useVyraActiveModule, useVyraNavigation } from "./vyra-module-context";

const steps = [
  { label: "Criar sua primeira tarefa", target: "vyra-tasks" },
  { label: "Organizar a agenda", target: "vyra-calendar" },
  { label: "Conversar com a MYKA", target: "vyra-ai" },
  { label: "Conhecer o Meu Dia", target: "vyra-planner" },
];

export default function FirstSteps({ userId }: { userId: string }) {
  const activeModule = useVyraActiveModule();
  const { navigateTo } = useVyraNavigation();
  const [done, setDone] = useState<number[]>([]);
  const [dismissed, setDismissed] = useState(true);
  const [expanded, setExpanded] = useState(false);
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
  if (activeModule !== "home" || dismissed || done.length === steps.length) return null;
  return <section className="rounded-xl border border-violet-400/20 bg-slate-900/60 p-3 text-white" aria-label="Primeiros passos">
    <div className="flex items-center justify-between gap-3">
      <button type="button" aria-expanded={expanded} onClick={()=>setExpanded(old=>!old)} className="min-w-0 flex-1 text-left"><span className="block text-sm font-semibold text-violet-100">Primeiros passos · {done.length} de {steps.length}</span><span className="block text-xs text-slate-400">Seu guia para começar na MYRYRA {expanded?"▲":"▼"}</span></button>
      <button type="button" onClick={()=>persist(done,true)} className="rounded-lg border border-white/15 px-2 py-2 text-xs text-slate-300">Dispensar</button>
    </div>
    {expanded&&<ol className="mt-3 grid gap-2 sm:grid-cols-2">{steps.map((step,index)=><li key={step.target} className="flex items-center gap-2 rounded-lg border border-white/10 p-2">
      <input type="checkbox" aria-label={`Marcar ${step.label} como explorado`} checked={done.includes(index)} onChange={event=>persist(event.target.checked?[...done,index]:done.filter(i=>i!==index),false)}/>
      <button type="button" onClick={()=>navigateTo(step.target)} className="text-left text-xs text-violet-200 hover:underline">{step.label}</button>
    </li>)}</ol>}
  </section>;
}
