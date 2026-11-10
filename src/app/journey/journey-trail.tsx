"use client";

import { useEffect, useState } from "react";

type Journey = { id: string; title: string; status: string; target_date: string | null };
type Mission = { id: string; title: string; status: string; week?: number };

export default function JourneyTrail() {
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [selected, setSelected] = useState("");
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
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
        <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-sm text-amber-200" title="Moedas MYRA ainda não disponíveis">◈ MYRA · Em breve</div>
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
            <p className="mt-4 text-xs text-violet-200">MYRAs ainda não são creditadas. O compartilhamento divulga apenas esta conquista, sem detalhes das missões.</p>
          </div>
        </div>
      )}
      {loading ? <p className="mt-6 text-sm text-slate-300">Preparando seu mapa...</p> : !journeys.length ?
        <p className="mt-6 text-sm text-slate-300">Sua aventura começa com um sonho. Crie sua primeira jornada abaixo.</p> :
        <div className="relative mx-auto mt-8 max-w-xl pb-4">
          <div aria-hidden="true" className="absolute bottom-10 left-1/2 top-3 w-1 -translate-x-1/2 rounded-full bg-gradient-to-b from-fuchsia-500 via-violet-600 to-slate-700" />
          <ol className="relative space-y-7">
            {missions.map((m, i) => {
              const completed = m.status === "completed";
              const next = !completed && missions.slice(0, i).every(x => x.status === "completed");
              return <li key={m.id} className={"flex " + (i % 2 ? "justify-end" : "justify-start")}>
                <button type="button" disabled={!!busy} onClick={() => void complete(m)}
                  aria-label={(completed ? "Reabrir missão: " : "Concluir missão: ") + m.title}
                  className={"relative w-[47%] min-w-0 rounded-2xl border p-3 text-left shadow-lg transition-transform active:scale-95 disabled:opacity-60 " +
                    (completed ? "border-emerald-400/50 bg-emerald-950/70" : next ? "border-fuchsia-400 bg-violet-800/80 shadow-fuchsia-900/30" : "border-white/15 bg-slate-800/90")}>
                  <span className="text-xl">{completed ? "✦" : next ? "🚀" : "◇"}</span>
                  <span className="mt-1 block text-[10px] font-bold uppercase tracking-wider text-violet-200">Missão {i + 1}</span>
                  <span className="mt-1 block break-words text-xs leading-relaxed sm:text-sm">{m.title}</span>
                  <span className="mt-2 block text-[11px] font-semibold text-violet-200">{completed ? "✓ Concluída" : next ? "Sua próxima conquista" : "Toque ao concluir"}</span>
                </button>
              </li>;
            })}
          </ol>
          <div className="relative mx-auto mt-7 w-fit rounded-full border border-amber-400/40 bg-amber-400/10 px-5 py-3 text-center text-sm font-semibold text-amber-100">{finished ? "🏆 Destino alcançado!" : "🏆 Seu próximo marco"}</div>
        </div>}
      {error && <p role="alert" className="mt-4 text-sm text-rose-300">{error}</p>}
      <p className="mt-5 text-center text-xs text-slate-400">As missões só são concluídas quando você confirma. MYRAs e jornadas compartilhadas serão ativadas em uma etapa futura.</p>
    </section>
  );
}
