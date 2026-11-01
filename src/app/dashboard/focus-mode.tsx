"use client";
import FeatureHint from "./feature-hint";
import { createClient } from "@/lib/supabase/client";

import { useEffect, useRef, useState } from "react";

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
  const deadlineRef = useRef<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const savedRef = useRef(false);

  async function saveCompletedSession() {
    if (savedRef.current) return;
    savedRef.current = true;
    setSaving(true); setSaveStatus("");
    try {
      const supabase = createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error("Sessão concluída, mas não foi possível confirmar o login.");
      const { error } = await supabase.from("focus_sessions").insert({ user_id: user.id, duration_minutes: minutes });
      if (error) throw new Error("Sessão concluída, mas o registro no Score ainda não está habilitado neste ambiente.");
      setSaveStatus("Sessão registrada para o indicador Foco.");
      window.dispatchEvent(new Event("myryra:focus-updated"));
    } catch (error) { savedRef.current = false; setSaveStatus(error instanceof Error ? error.message : "Não foi possível registrar a sessão."); }
    finally { setSaving(false); }
  }

  useEffect(() => {
    if (!running || deadlineRef.current === null) return;
    const tick = () => {
      if (deadlineRef.current === null) return;
      const seconds = Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000));
      setRemaining(seconds);
      if (seconds === 0) {
        deadlineRef.current = null;
        setRunning(false);
        setFinished(true);
        void saveCompletedSession();
      }
    };
    tick();
    const interval = window.setInterval(tick, 500);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [running]);

  function toggle() {
    if (running) {
      if (deadlineRef.current !== null) {
        setRemaining(Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000)));
      }
      deadlineRef.current = null;
      setRunning(false);
    } else if (remaining > 0) {
      deadlineRef.current = Date.now() + remaining * 1000;
      setFinished(false);
      setRunning(true);
    }
  }

  function reset(nextMinutes = minutes) {
    deadlineRef.current = null;
    setRunning(false);
    setFinished(false);
    savedRef.current = false;
    setSaveStatus("");
    setRemaining(nextMinutes * 60);
  }

  return (
    <section aria-label="Modo foco" className="rounded-2xl border border-violet-500/30 bg-slate-900 p-5 text-white">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <FeatureHint label="MYRYRA · FOCUS MODE" title="Tempo para se concentrar" description="Oferece um temporizador para trabalhar com menos distrações." tip="Escolha uma tarefa e inicie uma sessão de foco." />
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
        <button type="button" disabled={remaining === 0} onClick={toggle}
          className="rounded-xl bg-violet-600 px-5 py-3 font-semibold text-white hover:bg-violet-500 disabled:opacity-50">
          {running ? "Pausar" : remaining < minutes * 60 ? "Continuar" : "Iniciar foco"}
        </button>
        <button type="button" onClick={() => reset()} className="rounded-xl border border-slate-700 px-5 py-3 text-slate-200 hover:bg-slate-800">Reiniciar</button>
      </div>
      {finished && <p role="status" className="mt-4 text-center text-emerald-300">Sessão concluída! Faça uma pausa antes da próxima.</p>}
      {saveStatus && <p role="status" className="mt-2 text-center text-xs text-violet-200">{saveStatus}</p>}
      {finished && !saving && saveStatus.includes("não foi possível") && <button type="button" onClick={() => void saveCompletedSession()} className="mt-2 rounded-lg border border-violet-400/40 px-3 py-2 text-xs text-violet-200">Tentar registrar novamente</button>}
      <p className="mt-4 text-xs text-slate-400">Temporizador local com correção de tempo ao retornar à aba. Ao concluir, tentamos registrar a duração no banco para o Score. A contagem em andamento é reiniciada ao recarregar a página.</p>
    </section>
  );
}
