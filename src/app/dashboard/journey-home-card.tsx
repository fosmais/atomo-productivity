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
  const [error, setError] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [journeyTitle, setJourneyTitle] = useState("");
  const [weeks, setWeeks] = useState(8);
  const [minutesPerDay, setMinutesPerDay] = useState(20);
  const [daysPerWeek, setDaysPerWeek] = useState(3);
  const [plan, setPlan] = useState<{ source: string; stages: { title: string; week: number; missions: string[] }[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [showCreator, setShowCreator] = useState(false);
  const [showAllMissions, setShowAllMissions] = useState(false);
  const [missionFilter, setMissionFilter] = useState<"pending" | "all">("pending");
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    if (active !== "home") return;
    let cancelled = false;
    fetch("/api/journeys", { cache: "no-store" }).then(async response => {
      if (!response.ok) throw new Error(response.status === 404 ? "disabled" : "Não foi possível carregar suas jornadas.");
      const data = await response.json();
      if (!cancelled) { setAvailable(true); setJourneys(data.journeys ?? []); setSelected(current => (data.journeys ?? []).some((journey: Journey) => journey.id === current) ? current : (data.journeys ?? [])[0]?.id ?? ""); }
    }).catch((cause: Error) => {
      if (!cancelled && cause.message !== "disabled") { setAvailable(true); setError(cause.message); }
    });
    return () => { cancelled = true; };
  }, [active]);
  useEffect(() => {
    if (!selected || active !== "home") { setMissions([]); setProgress(null); return; }
    let cancelled = false;
    setMissions([]);
    setProgress(null);
    fetch(`/api/journeys/${encodeURIComponent(selected)}/missions`, { cache: "no-store" })
      .then(async response => { if (!response.ok) throw new Error("Missões indisponíveis."); return response.json(); })
      .then(data => { if (!cancelled) { setMissions(data.missions ?? []); setProgress(data.progress); } })
      .catch(() => { if (!cancelled) { setMissions([]); setProgress(null); setError("Não foi possível carregar as missões."); } });
    return () => { cancelled = true; };
  }, [selected, active, refresh]);
  async function previewPlan() {
    if (!journeyTitle.trim() || busy) return;
    setBusy(true); setError(""); setPlan(null);
    try {
      const response = await fetch("/api/journeys/plan-preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ goal: journeyTitle.trim(), weeks, minutesPerDay, daysPerWeek }) });
      if (!response.ok) {
        const detail = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(detail?.error || "Não foi possível preparar a trilha.");
      }
      setPlan(await response.json());
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Erro na prévia."); }
    finally { setBusy(false); }
  }
  async function createJourney(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!journeyTitle.trim() || busy) return;
    if (plan) {
      const titles = plan.stages.flatMap(stage => stage.missions.map(title => title.trim()).filter(Boolean));
      if (titles.length === 0) { setError("Adicione ao menos uma missão antes de confirmar."); return; }
      if (titles.length > 30) { setError("A trilha pode ter no máximo 30 missões."); return; }
      if (titles.some(title => title.length > 160)) { setError("Cada missão deve ter no máximo 160 caracteres."); return; }
      if (new Set(titles.map(title => title.toLocaleLowerCase("pt-BR"))).size !== titles.length) { setError("Há missões repetidas na trilha. Revise antes de confirmar."); return; }
    }
    setBusy(true); setError("");
    try {
      const proposed = plan?.stages.flatMap(stage => stage.missions.map(title => title.trim()).filter(Boolean)) ?? [];
      const response = await fetch("/api/journeys", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: journeyTitle.trim(), ...(plan ? { missions: proposed } : {}) }),
      });
      if (!response.ok) {
        const detail = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(detail?.error || "Não foi possível criar sua jornada.");
      }
      const data = await response.json();
      const created = data.journey as Journey;
      setJourneys(current => [created, ...current]);
      setSelected(created.id);
      setJourneyTitle(""); setShowCreator(false);
      setPlan(null);
      setRefresh(value => value + 1);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Erro ao criar jornada."); }
    finally { setBusy(false); }
  }
  async function addMission(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !newTitle.trim() || busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/journeys/${encodeURIComponent(selected)}/missions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: newTitle.trim() }) });
      if (!response.ok) throw new Error("Não foi possível adicionar a missão.");
      setNewTitle(""); setRefresh(value => value + 1);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Erro ao salvar missão."); }
    finally { setBusy(false); }
  }
  async function toggleMission(mission: Mission) {
    if (!selected || busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/journeys/${encodeURIComponent(selected)}/missions/${encodeURIComponent(mission.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: mission.status === "completed" ? "pending" : "completed" }) });
      if (!response.ok) throw new Error("Não foi possível atualizar a missão.");
      setRefresh(value => value + 1);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Erro ao atualizar missão."); }
    finally { setBusy(false); }
  }
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
          <select className="ml-2 max-w-40 rounded-lg border border-white/20 bg-slate-900 px-2 py-2 text-white" value={selected} onChange={event => { setError(""); setShowAllMissions(false); setMissionFilter("pending"); setSelected(event.target.value); }}>
            {journeys.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
          </select>
        </label>}
      </div>
      {journey && !showCreator ? <>
        <div className="mt-4 flex items-end justify-between gap-2">
          <div><span className="text-3xl font-bold tabular-nums text-white">{progress ? `${progress.percent}%` : "—"}</span><p className="text-xs text-slate-300">{progress ? `${progress.completed} de ${progress.total} missões concluídas` : "Carregando progresso"}</p></div>
          {journey.target_date && <span className="text-xs text-amber-100">Meta: {journey.target_date.split("-").reverse().join("/")}</span>}
        </div>
        {progress && progress.total > 0 && <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-200" aria-live="polite">
          <span>{progress.total - progress.completed === 0 ? "Todas as missões realizadas" : `${progress.total - progress.completed} ${progress.total - progress.completed === 1 ? "missão restante" : "missões restantes"}`}</span>
          <span>{progress.completed === 0 ? "Sua primeira conquista está à frente" : progress.completed === progress.total ? "Objetivo alcançado!" : "Continue no seu ritmo"}</span>
        </div>}
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/15" role="progressbar" aria-label="Progresso da jornada" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress?.percent ?? 0}>
          <div className="h-full rounded-full bg-amber-400 transition-all" style={{ width: `${progress?.percent ?? 0}%` }} />
        </div>
        {progress && progress.total > 0 && <div className="mt-3 grid grid-cols-3 gap-2" aria-label="Marcos da jornada">
          {[25, 50, 100].map(milestone => <div key={milestone} className={`rounded-xl border p-2 text-center ${progress.percent >= milestone ? "border-amber-300/40 bg-amber-400/15 text-amber-100" : "border-white/10 bg-white/5 text-slate-400"}`}>
            <p className="text-sm font-bold">{progress.percent >= milestone ? "★" : "◇"} {milestone}%</p>
            <p className="text-[10px]">{milestone === 25 ? "Primeiro avanço" : milestone === 50 ? "Meio caminho" : "Jornada concluída"}</p>
          </div>)}
        </div>}
        <div className="mt-4 rounded-xl border border-amber-300/25 bg-gradient-to-r from-amber-400/10 to-violet-400/10 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-200">✦ Sua missão de agora</p>
            <span className="rounded-full border border-amber-300/25 px-2 py-1 text-[10px] text-amber-100">Um passo de cada vez</span>
          </div>
          <p className="mt-2 text-base font-semibold text-white">{next?.title ?? (progress?.total ? "Você concluiu todas as missões. Celebre sua evolução!" : "Sua primeira missão ainda não foi definida")}</p>
          <p className="mt-1 text-xs text-slate-300">{next ? "O futuro que você deseja começa com uma ação possível hoje." : progress?.total ? "Você chegou a um marco importante. Pode iniciar uma nova jornada ou definir novos desafios." : "A MIKA pode ajudar você a definir seu próximo passo."}</p>
          {progress?.total && progress.completed === progress.total ? <div role="status" className="mt-3 rounded-xl border border-amber-300/40 bg-amber-400/10 p-3">
            <p className="text-sm font-bold text-amber-100">★ Você chegou lá!</p>
            <p className="mt-1 text-xs text-slate-200">Cada missão concluída ajudou a construir esta conquista. Sua evolução continua.</p>
            <button type="button" disabled={busy} onClick={() => { setShowCreator(true); setPlan(null); setError(""); }} className="mt-3 rounded-lg bg-amber-400 px-3 py-2 text-xs font-bold text-slate-950 disabled:opacity-50">Começar minha próxima jornada</button>
          </div> : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {next && <button type="button" disabled={busy} onClick={() => void toggleMission(next)} className="rounded-xl bg-amber-400 px-3 py-2 text-xs font-bold text-slate-950 disabled:opacity-50">✓ Concluí esta missão</button>}
            <button type="button" onClick={() => navigateTo("vyra-ai")} className="rounded-xl border border-violet-300/40 px-3 py-2 text-xs font-semibold text-violet-100">Pedir orientação à MIKA</button>
            <button type="button" onClick={() => navigateToQuickAction?.("capture")} className="rounded-xl border border-white/20 px-3 py-2 text-xs font-semibold text-white">Organizar nas tarefas</button>
            <button type="button" onClick={() => navigateTo("vyra-calendar")} className="rounded-xl border border-white/20 px-3 py-2 text-xs font-semibold text-white">Abrir Agenda</button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold text-slate-200">Minhas missões</p>
          <div className="flex gap-1 rounded-lg border border-white/15 p-1" role="group" aria-label="Filtrar missões">
            <button type="button" aria-pressed={missionFilter === "pending"} onClick={() => { setMissionFilter("pending"); setShowAllMissions(false); }} className={`rounded-md px-2 py-1 text-xs ${missionFilter === "pending" ? "bg-amber-400 text-slate-950" : "text-slate-300"}`}>Pendentes</button>
            <button type="button" aria-pressed={missionFilter === "all"} onClick={() => { setMissionFilter("all"); setShowAllMissions(false); }} className={`rounded-md px-2 py-1 text-xs ${missionFilter === "all" ? "bg-amber-400 text-slate-950" : "text-slate-300"}`}>Todas</button>
          </div>
        </div>
        {missionFilter === "pending" && missions.length > 0 && missions.every(mission => mission.status === "completed") && <p className="mt-2 text-xs text-amber-100">Todas concluídas! Veja o histórico em “Todas”.</p>}
        <div className="mt-3 space-y-2" aria-label="Missões da jornada">
          {(showAllMissions ? missions.filter(mission => missionFilter === "all" || mission.status !== "completed") : missions.filter(mission => missionFilter === "all" || mission.status !== "completed").slice(0, 5)).map(mission => <label key={mission.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white">
            <input type="checkbox" checked={mission.status === "completed"} disabled={busy} onChange={() => void toggleMission(mission)} className="h-4 w-4 accent-amber-400" />
            <span className={mission.status === "completed" ? "text-slate-400 line-through" : ""}>{mission.title}</span>
          </label>)}
        </div>
        {missions.filter(mission => missionFilter === "all" || mission.status !== "completed").length > 5 && <button type="button" onClick={() => setShowAllMissions(value => !value)} className="mt-2 rounded-lg border border-white/20 px-3 py-2 text-xs text-slate-200">{showAllMissions ? "Mostrar menos missões" : `Ver todas as ${missions.filter(mission => missionFilter === "all" || mission.status !== "completed").length} missões`}</button>}
        <form onSubmit={event => void addMission(event)} className="mt-3 flex flex-wrap gap-2">
          <input aria-label="Nova missão" placeholder="Qual é seu próximo passo?" maxLength={160} value={newTitle} onChange={event => setNewTitle(event.target.value)} className="min-w-0 flex-1 rounded-xl border border-white/20 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-400" />
          <button type="submit" disabled={busy || !newTitle.trim()} className="rounded-xl border border-amber-400/50 px-3 py-2 text-xs font-semibold text-amber-100 disabled:opacity-50">+ Missão</button>
        </form>
      </> : <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-slate-200"><p>Qual objetivo você quer transformar em uma jornada?</p>
        <form onSubmit={event => void createJourney(event)} className="mt-3 flex flex-wrap gap-2">
          <input aria-label="Nome da nova jornada" placeholder="Ex.: Correr meus primeiros 5 km" maxLength={120} value={journeyTitle} onChange={event => { setJourneyTitle(event.target.value); setPlan(null); }} className="min-w-0 flex-1 rounded-xl border border-white/20 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-400" />
          <button type="submit" disabled={busy || !journeyTitle.trim()} className="rounded-xl bg-amber-400 px-3 py-2 text-xs font-bold text-slate-950 disabled:opacity-50">{plan ? "Confirmar jornada e missões" : "Criar jornada sem trilha"}</button>
        </form>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="text-xs text-slate-300">Prazo em semanas <input type="number" min={1} max={52} value={weeks} onChange={event => { setWeeks(Number(event.target.value)); setPlan(null); }} className="ml-2 w-16 rounded-lg border border-white/20 bg-slate-950 p-2 text-white" /></label>
          <label className="text-xs text-slate-300">Minutos/dia <input type="number" min={5} max={240} value={minutesPerDay} onChange={event => { setMinutesPerDay(Number(event.target.value)); setPlan(null); }} className="ml-2 w-16 rounded-lg border border-white/20 bg-slate-950 p-2 text-white" /></label>
          <label className="text-xs text-slate-300">Dias/semana <input type="number" min={1} max={7} value={daysPerWeek} onChange={event => { setDaysPerWeek(Number(event.target.value)); setPlan(null); }} className="ml-2 w-14 rounded-lg border border-white/20 bg-slate-950 p-2 text-white" /></label>
          <button type="button" disabled={busy || !journeyTitle.trim() || weeks < 1 || weeks > 52 || minutesPerDay < 5 || minutesPerDay > 240 || daysPerWeek < 1 || daysPerWeek > 7} onClick={() => void previewPlan()} className="rounded-xl border border-violet-400/50 px-3 py-2 text-xs text-violet-100 disabled:opacity-50">Ver sugestão de trilha</button>
        </div>
        {plan && <div className="mt-3 space-y-2" aria-label="Prévia da trilha">
          <p className="text-xs text-amber-200">{plan.source === "mika_ai" ? "Trilha personalizada pela MIKA. Revise antes de confirmar." : "Trilha automática por categoria (MIKA indisponível). Revise antes de confirmar."}</p>
          <p className="text-xs text-slate-300">Você pode editar cada missão antes de confirmar.</p>
          {plan.stages.map((stage, stageIndex) => <div key={stageIndex} className="space-y-2 rounded-lg border border-white/10 p-2">
            <p className="text-xs font-semibold text-amber-200">Semana {stage.week} · {stage.title}</p>
            {stage.missions.map((mission, missionIndex) => <div key={missionIndex} className="flex gap-2">
              <input aria-label={`Missão ${missionIndex + 1} da etapa ${stageIndex + 1}`} maxLength={160} value={mission} onChange={event => setPlan(current => current ? { ...current, stages: current.stages.map((item, i) => i === stageIndex ? { ...item, missions: item.missions.map((text, j) => j === missionIndex ? event.target.value : text) } : item) } : null)} className="min-w-0 flex-1 rounded-lg border border-white/20 bg-slate-950 p-2 text-xs text-white" />
              <button type="button" aria-label="Remover missão" onClick={() => setPlan(current => current ? { ...current, stages: current.stages.map((item, i) => i === stageIndex ? { ...item, missions: item.missions.filter((_, j) => j !== missionIndex) } : item) } : null)} className="rounded-lg border border-rose-400/30 px-3 text-xs text-rose-200">×</button>
            </div>)}
          </div>)}
          <p className="text-xs text-slate-400">Ao confirmar, a jornada e as missões revisadas serão criadas.</p>
        </div>}
        <p className="mt-2 text-xs text-slate-400">Sua jornada começa privada. Depois, você poderá adicionar missões.</p></div>}
      {journey && <button type="button" disabled={busy} onClick={() => { setShowCreator(value => !value); setError(""); setPlan(null); }} className="mt-3 rounded-xl border border-amber-400/40 px-3 py-2 text-xs font-semibold text-amber-100 disabled:opacity-50">{showCreator ? "Voltar à minha jornada" : "+ Criar outra jornada"}</button>}
      {error && <p role="alert" className="mt-2 text-xs text-rose-200">{error}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => navigateToQuickAction?.("goals")} className="rounded-xl bg-amber-400 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-amber-300">{journey ? "Ver minhas metas" : "Definir minha meta"}</button>
        <button type="button" onClick={() => navigateTo("vyra-ai")} className="rounded-xl border border-violet-300/40 px-4 py-2 text-xs font-semibold text-violet-100 hover:bg-violet-500/20">✦ Conversar com a MIKA</button>
      </div>
    </section>
  );
}
