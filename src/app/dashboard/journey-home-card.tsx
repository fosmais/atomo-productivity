"use client";

import { useEffect, useState } from "react";
import { useVyraActiveModule, useVyraNavigation } from "./vyra-module-context";

type Journey = { id: string; title: string; description: string | null; target_date: string | null };
type Mission = { id: string; title: string; status: string };
type JourneyProgress = { percent: number; completed: number; total: number };

export default function JourneyHomeCard() {
  const active = useVyraActiveModule();
  const { navigateTo, navigateToQuickAction } = useVyraNavigation();
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [selected, setSelected] = useState("");
  const [missions, setMissions] = useState<Mission[]>([]);
  const [progress, setProgress] = useState<JourneyProgress | null>(null);
  const [available, setAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    if (active !== "home") return;
    let cancelled = false;
    fetch("/api/journeys", { cache: "no-store" }).then(async response => {
      if (!response.ok) throw new Error(response.status === 404 ? "disabled" : "Não foi possível carregar suas jornadas.");
      const data = await response.json();
      if (!cancelled) { setAvailable(true); setJourneys(data.journeys ?? []); setSelected((data.journeys ?? [])[0]?.id ?? ""); }
    }).catch((cause: Error) => {
      if (!cancelled && cause.message !== "disabled") { setAvailable(true); setError(cause.message); }
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [active]);
  useEffect(() => {
    if (!selected || active !== "home") return;
    let cancelled = false;
    setMissions([]);
    setProgress(null);
    fetch(`/api/journeys/${encodeURIComponent(selected)}/missions`, { cache: "no-store" })
      .then(async response => { if (!response.ok) throw new Error("Missões indisponíveis."); return response.json(); })
      .then(data => { if (!cancelled) { setMissions(data.missions ?? []); setProgress(data.progress); } })
      .catch(() => { if (!cancelled) setError("Não foi possível carregar as missões."); });
    return () => { cancelled = true; };
  }, [selected, active]);
  if (active !== "home" || !available) return null;
  const journey = journeys.find(item => item.id === selected);
  const next = missions.find(item => item.status !== "completed");
  return (
    <section className="rounded-2xl border border-amber-400/35 bg-gradient-to-br from-amber-500/15 via-violet-950/50 to-slate-950 p-4 sm:p-5" aria-label="MYRYRA Journey">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-200">☀ MYRYRA JOURNEY</p>
          <h2 className="mt-1 text-lg font-semibold text-white">{journey ? journey.title : "Sua jornada começa aqui"}</h2>
          <p className="mt-1 text-xs text-slate-300">{journey ? "Cada missão é um passo em direção ao seu objetivo." : "Transforme uma meta em uma jornada de pequenas conquistas."}</p>
        </div>
        {journeys.length > 1 && <label className="text-xs text-slate-300">Minha jornada
          <select className="ml-2 max-w-40 rounded-lg border border-white/20 bg-slate-900 px-2 py-2 text-white" value={selected} onChange={event => { setError(""); setSelected(event.target.value); }}>
            {journeys.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
          </select>
        </label>}
      </div>
      {journey ? <>
        <div className="mt-4 flex items-end justify-between gap-2">
          <div><span className="text-3xl font-bold tabular-nums text-white">{progress ? `${progress.percent}%` : "—"}</span><p className="text-xs text-slate-300">{progress ? `${progress.completed} de ${progress.total} missões concluídas` : "Carregando progresso"}</p></div>
          {journey.target_date && <span className="text-xs text-amber-100">Meta: {journey.target_date.split("-").reverse().join("/")}</span>}
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/15" role="progressbar" aria-label="Progresso da jornada" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress?.percent ?? 0}>
          <div className="h-full rounded-full bg-amber-400 transition-all" style={{ width: `${progress?.percent ?? 0}%` }} />
        </div>
        <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
          <p className="text-[10px] uppercase tracking-wider text-amber-200">Próxima missão</p>
          <p className="mt-1 text-sm font-semibold text-white">{next?.title ?? (progress?.total ? "Todas as missões concluídas!" : "Sua primeira missão ainda não foi definida")}</p>
        </div>
      </> : <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-slate-200">Comece pelas suas metas atuais. Em breve a MIKA poderá transformar cada meta em uma trilha personalizada.</div>}
      {error && <p role="alert" className="mt-2 text-xs text-rose-200">{error}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => navigateToQuickAction?.("goals")} className="rounded-xl bg-amber-400 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-amber-300">{journey ? "Ver minhas metas" : "Definir minha meta"}</button>
        <button type="button" onClick={() => navigateTo("vyra-ai")} className="rounded-xl border border-violet-300/40 px-4 py-2 text-xs font-semibold text-violet-100 hover:bg-violet-500/20">✦ Conversar com a MIKA</button>
      </div>
    </section>
  );
}
