"use client";

import { useEffect, useState } from "react";

type Journey = { id: string; title: string; status: string; target_date: string | null };
type Mission = { id: string; title: string; status: string; week?: number };

export default function JourneyTrail() {
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [selected, setSelected] = useState("");
  const [missions, setMissions] = useState<Mission[]>([]);
  const [myraBalance, setMyraBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [celebratedMission, setCelebratedMission] = useState<string | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    fetch("/api/journeys", { cache: "no-store" }).then(async r => {
      if (!r.ok) throw new Error("Não foi possível carregar suas jornadas.");
      return r.json();
    }).then(data => {
      if (!alive) return;
      const items = Array.isArray(data.journeys) ? data.journeys as Journey[] : [];
      setJourneys(items);
      if (items.length) setSelected(items[0].id);
    }).catch(e => { if (alive) setError(e instanceof Error ? e.message : "Falha ao carregar."); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    if (!selected) return;
    let alive = true;
    fetch("/api/journeys/" + encodeURIComponent(selected), { cache: "no-store" })
      .then(async r => { if (!r.ok) throw new Error("Não foi possível carregar as missões."); return r.json(); })
      .then(data => { if (alive) setMissions(Array.isArray(data.missions) ? data.missions : []); })
      .catch(e => { if (alive) setError(e instanceof Error ? e.message : "Falha ao carregar."); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [selected]);
  async function refreshMyra() {
    try {
      const response = await fetch("/api/journeys/myra", { cache: "no-store" });
      if (!response.ok) return;
      const payload = await response.json();
      if (typeof payload.balance === "number") setMyraBalance(payload.balance);
    } catch { /* Balance can be retried after a mission. */ }
  }
  useEffect(() => {
    const loadBalance = async () => {
      try {
        const response = await fetch("/api/journeys/myra", { cache: "no-store" });
        if (!response.ok) return;
        const payload = await response.json();
        if (typeof payload.balance === "number") setMyraBalance(payload.balance);
      } catch { /* Balance remains unavailable until retry. */ }
    };
    void loadBalance();
  }, []);
  async function complete(mission: Mission) {
    if (busy) return;
    setBusy(mission.id);
    setError("");
    try {
      const r = await fetch("/api/journeys/" + encodeURIComponent(selected) + "/missions/" + encodeURIComponent(mission.id), {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: mission.status === "completed" ? "pending" : "completed" })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Não foi possível atualizar a missão.");
      setMissions(old => old.map(m => m.id === mission.id ? { ...m, status: data.mission.status } : m));
      void refreshMyra();
      if (data.mission.status === "completed") setCelebratedMission(mission.id);
      else setCelebratedMission(null);
    } catch (e) { setError(e instanceof Error ? e.message : "Falha ao atualizar."); }
    finally { setBusy(""); }
  }
  const done = missions.filter(m => m.status === "completed").length;
  const percent = missions.length ? Math.round(done / missions.length * 100) : 0;
  const current = journeys.find(j => j.id === selected);
  const finished = missions.length > 0 && done === missions.length;
  async function shareVictory() {
    if (!current || !finished) return;
    const message = "🏆 Concluí minha jornada " + current.title + " na MYRYRA! " + done + " missões realizadas. ✨";
    try {
      if (navigator.share) {
        await navigator.share({ title: "Minha conquista MYRYRA", text: message, url: "https://myryra.com/journey" });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(message + " https://myryra.com/journey");
        setError("Mensagem de conquista copiada para compartilhar.");
      } else {
        setError("Compartilhamento não disponível neste navegador.");
      }
    } catch (cause) {
      if (cause instanceof Error && cause.name === "AbortError") return;
      setError("Não foi possível compartilhar. Tente novamente.");
    }
  }
  return (
    <section aria-label="Mapa da minha jornada" className="overflow-hidden rounded-3xl border border-violet-400/30 bg-gradient-to-b from-violet-950/80 via-slate-900 to-slate-950 p-4 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-300">✦ Meu universo em evolução</p><h2 className="mt-2 text-2xl font-bold">O mapa da sua jornada</h2></div>
        <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-sm font-semibold text-amber-200" title="Moedas virtuais de conquistas, sem valor monetário">◈ {myraBalance === null ? "MYRA · Carregando" : myraBalance + " MYRAs"}</div>
      </div>
      {journeys.length > 1 && <label className="mt-5 block text-sm text-slate-300">Escolha sua aventura
        <select className="mt-2 w-full rounded-xl border border-violet-400/30 bg-slate-900 p-3 text-white" value={selected} onChange={e => setSelected(e.target.value)}>
          {journeys.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
        </select></label>}
      {current && <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
        <p className="text-xs uppercase tracking-widest text-violet-300">Destino escolhido</p>
        <h3 className="mt-1 text-2xl font-bold">✧ {current.title}</h3>
        <p className="mt-1 text-sm text-slate-300">{current.target_date ? "Meta: " + current.target_date : "Uma conquista de cada vez"}</p>
        <div className="mt-4 flex items-center justify-between text-sm"><span>{done} de {missions.length} missões</span><strong>{percent}%</strong></div>
        <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-700" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Progresso da jornada"><div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-400 transition-all duration-500" style={{ width: percent + "%" }} /></div>
      </div>}
      {celebratedMission && !finished && <div role="status" className="mt-5 rounded-2xl border border-amber-300/50 bg-gradient-to-r from-violet-900/90 to-fuchsia-900/80 p-4 text-center shadow-[0_0_35px_rgba(232,121,249,0.2)]"><span aria-hidden="true" className="block text-4xl motion-safe:animate-bounce">🌟</span><p className="mt-2 text-lg font-bold text-amber-200">Missão conquistada!</p><p className="mt-1 text-sm text-violet-100">A MIKA está celebrando seu progresso. Continue avançando pelo mapa!</p><button type="button" onClick={() => setCelebratedMission(null)} className="mt-3 rounded-xl border border-white/30 px-4 py-2 text-xs font-semibold text-white">Continuar minha aventura</button></div>}
      {current && finished && !loading && (
        <div role="status" aria-label="Jornada concluída" className="relative mt-6 overflow-hidden rounded-3xl border border-amber-300/50 bg-gradient-to-br from-amber-500/25 via-fuchsia-700/25 to-violet-900/80 p-6 text-center shadow-[0_0_60px_rgba(217,70,239,0.18)] sm:p-9">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-50" style={{ backgroundImage: "radial-gradient(circle at 20% 20%, #fbbf24 1px, transparent 2px), radial-gradient(circle at 80% 60%, #e879f9 1px, transparent 2px)", backgroundSize: "37px 43px, 53px 61px" }} />
          <div className="relative">
            <div className="text-5xl motion-safe:animate-bounce" aria-hidden="true">🏆</div>
            <p className="mt-3 text-xs font-bold uppercase tracking-[0.25em] text-amber-200">Destino alcançado</p>
            <h3 className="mt-2 text-3xl font-extrabold text-white sm:text-4xl">Você conseguiu!</h3>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-violet-100">Sua jornada <strong>{current.title}</strong> chegou ao destino. Foram <strong>{done} missões concluídas</strong>. Cada passo fez parte dessa conquista.</p>
            <p className="mt-3 text-sm font-medium text-amber-200">✦ MIKA: que conquista incrível! Celebre este momento. Seu próximo sonho já pode começar.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button type="button" onClick={() => void shareVictory()} className="rounded-xl bg-amber-300 px-5 py-3 text-sm font-bold text-slate-950 transition-transform active:scale-95">✨ Compartilhar conquista</button>
              <button type="button" onClick={() => { const details = document.getElementById("journey-create-details") as HTMLDetailsElement | null; if (details) { details.open = true; details.scrollIntoView({ behavior: "smooth", block: "start" }); } }} className="rounded-xl border border-white/40 bg-white/10 px-5 py-3 text-sm font-semibold text-white">🚀 Começar outra aventura</button>
            </div>
            <p className="mt-4 text-xs text-violet-200">Cada missão concluída rende 10 MYRAs uma única vez. O compartilhamento não revela detalhes das missões.</p>
          </div>
        </div>
      )}
      {loading ? <p className="mt-6 text-sm text-slate-300">Preparando seu mapa...</p> : !journeys.length ?
        <p className="mt-6 text-sm text-slate-300">Sua aventura começa com um sonho. Crie sua primeira jornada abaixo.</p> :
        <div className="relative mx-auto mt-7 max-w-2xl overflow-hidden rounded-[2rem] border border-violet-300/15 bg-gradient-to-b from-indigo-950 via-violet-950/70 to-slate-950 px-3 py-7 sm:px-7">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-70" style={{ backgroundImage: "radial-gradient(circle at 12% 18%, #f0abfc 1px, transparent 2px), radial-gradient(circle at 77% 42%, #fbbf24 1px, transparent 2px), radial-gradient(circle at 48% 78%, #93c5fd 1px, transparent 2px)", backgroundSize: "83px 97px, 131px 113px, 97px 151px" }} />
          <div className="relative mb-7 text-center">
            <span className="inline-flex rounded-full border border-amber-300/40 bg-amber-300/10 px-4 py-2 text-xs font-bold uppercase tracking-widest text-amber-200">✦ O início da aventura</span>
            <p className="mt-2 text-xs text-violet-200">Cada parada é uma conquista no caminho do seu sonho.</p>
          </div>
          <div className="relative">
            <svg aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
              <path d="M 50 0 C 50 8, 16 8, 16 17 S 84 27, 84 35 S 16 45, 16 53 S 84 63, 84 71 S 16 81, 16 89 S 50 97, 50 100" fill="none" stroke="#a78bfa" strokeWidth="1.8" strokeDasharray="2 2" opacity=".65" vectorEffect="non-scaling-stroke" />
              <path d="M 50 0 C 50 8, 16 8, 16 17 S 84 27, 84 35 S 16 45, 16 53 S 84 63, 84 71 S 16 81, 16 89 S 50 97, 50 100" fill="none" stroke="#e879f9" strokeWidth=".6" opacity=".4" vectorEffect="non-scaling-stroke" />
            </svg>
            <ol className="relative space-y-5">
              {missions.map((m, i) => {
                const completed = m.status === "completed";
                const next = !completed && missions.slice(0, i).every(x => x.status === "completed");
                return <li key={m.id} className={"flex " + (i % 2 ? "justify-end" : "justify-start")}>
                  <button type="button" disabled={!!busy} onClick={() => void complete(m)}
                    aria-label={(completed ? "Reabrir missão: " : "Concluir missão: ") + m.title}
                    className={"group relative w-[78%] min-w-0 rounded-2xl border p-4 text-left shadow-xl backdrop-blur-md transition-all duration-300 hover:-translate-y-1 active:scale-[.98] disabled:opacity-60 sm:w-[69%] " +
                      (completed ? "border-emerald-300/60 bg-emerald-950/90 shadow-emerald-900/20" : next ? "border-amber-300/80 bg-violet-800/95 shadow-fuchsia-600/20 ring-2 ring-fuchsia-400/25" : "border-violet-300/25 bg-slate-900/95")}>
                    <span aria-hidden="true" className={"absolute -top-3 " + (i % 2 ? "-right-2" : "-left-2") + " flex h-9 w-9 items-center justify-center rounded-full border-2 border-violet-200/70 bg-violet-800 text-lg shadow-lg"}>{completed ? "⭐" : next ? "🚀" : "🔮"}</span>
                    <span className="block text-[10px] font-bold uppercase tracking-[.18em] text-violet-200">Etapa {i + 1} · {m.week ? "Semana " + m.week : "Sua missão"}</span>
                    <span className="mt-2 block break-words text-sm font-semibold leading-relaxed text-white sm:text-base">{m.title}</span>
                    <span className={"mt-3 inline-flex rounded-full px-3 py-1 text-[11px] font-bold " + (completed ? "bg-emerald-400/20 text-emerald-200" : next ? "bg-amber-300/20 text-amber-200" : "bg-white/10 text-violet-200")}>{completed ? "✓ Conquista realizada" : next ? "✦ Sua próxima missão" : "◇ Aguardando sua vez"}</span>
                  </button>
                </li>;
              })}
            </ol>
          </div>
          <div className="relative mx-auto mt-8 w-fit rounded-2xl border border-amber-300/50 bg-amber-300/15 px-6 py-4 text-center shadow-[0_0_35px_rgba(251,191,36,0.12)]">
            <span className="block text-3xl" aria-hidden="true">{finished ? "🏆" : "🏰"}</span>
            <span className="mt-1 block text-sm font-bold text-amber-100">{finished ? "Destino conquistado!" : "O destino dos seus sonhos"}</span>
          </div>
        </div>}
      {error && <p role="alert" className="mt-4 text-sm text-rose-300">{error}</p>}
      <p className="mt-5 text-center text-xs text-slate-400">Cada missão concluída vale 10 MYRAs virtuais, uma única vez. As moedas não possuem valor monetário.</p>
    </section>
  );
}
