"use client";

import { useEffect, useState } from "react";

const DEFAULT_MINUTES = 25;

function formatTime(seconds: number) {
  return `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}

export default function FocusMode() {
  const [minutes, setMinutes] = useState(DEFAULT_MINUTES);
  const [remaining, setRemaining] = useState(DEFAULT_MINUTES * 60);
  const [running, setRunning] = useState(false);
  const [task, setTask] = useState("");
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (!running) return;
    const interval = window.setInterval(() => {
      setRemaining((current) => {
        if (current <= 1) {
          setRunning(false);
          setFinished(true);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [running]);

  function reset(nextMinutes = minutes) {
    setRunning(false);
    setFinished(false);
    setRemaining(nextMinutes * 60);
  }

  return (
    <section aria-label="Modo foco" className="rounded-2xl border border-violet-500/30 bg-slate-900 p-5 text-white">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-violet-400">MYRYRA · FOCUS MODE</p>
          <h3 className="mt-1 text-xl font-semibold">Uma coisa de cada vez.</h3>
        </div>
        <label className="text-sm text-slate-300">
          Duração
          <select aria-label="Duração da sessão" className="ml-2 rounded-lg border border-slate-700 bg-slate-950 p-2 text-white" value={minutes}
            onChange={(event) => {
              const next = Number(event.target.value);
              setMinutes(next);
              reset(next);
            }}>
            <option value={15}>15 min</option>
            <option value={25}>25 min</option>
            <option value={45}>45 min</option>
            <option value={60}>60 min</option>
          </select>
        </label>
      </div>
      <label htmlFor="focus-task" className="mt-4 block text-sm text-slate-300">No que você vai focar?</label>
      <input id="focus-task" maxLength={160} value={task} onChange={(event) => setTask(event.target.value)}
        placeholder="Ex.: preparar apresentação" className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white placeholder:text-slate-500" />
      <p role="timer" aria-label="Tempo restante" className="my-5 text-center font-mono text-5xl font-semibold tabular-nums text-violet-200">{formatTime(remaining)}</p>
      <div className="flex flex-wrap justify-center gap-3">
        <button type="button" disabled={remaining === 0} onClick={() => setRunning((value) => !value)}
          className="rounded-xl bg-violet-600 px-5 py-3 font-semibold text-white hover:bg-violet-500 disabled:opacity-50">
          {running ? "Pausar" : remaining < minutes * 60 ? "Continuar" : "Iniciar foco"}
        </button>
        <button type="button" onClick={() => reset()} className="rounded-xl border border-slate-700 px-5 py-3 text-slate-200 hover:bg-slate-800">Reiniciar</button>
      </div>
      {finished && <p role="status" className="mt-4 text-center text-emerald-300">Sessão concluída! Faça uma pausa antes da próxima.</p>}
      <p className="mt-4 text-xs text-slate-400">Temporizador local. Mantenha esta aba aberta; nesta versão as sessões não são gravadas no banco.</p>
    </section>
  );
}
