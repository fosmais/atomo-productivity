"use client";

import { useEffect, useRef, useState } from "react";
type SavedJourneySummary = { id: string; title: string; status: string; target_date: string | null };
import type { JourneyDraft } from "@/lib/journey/create-journey-draft";

export default function MikaJourneyPlanner() {
  const [title, setTitle] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [days, setDays] = useState(3);
  const [draft, setDraft] = useState<JourneyDraft | null>(null);
  const [useAI, setUseAI] = useState(false);
  const [snapshotId, setSnapshotId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submittingRef = useRef(false);
  const confirmationKeyRef = useRef<string | null>(null);
  const [message, setMessage] = useState("");
  const [saved, setSaved] = useState(false);
  const [journeys, setJourneys] = useState<SavedJourneySummary[]>([]);
  const [loadingJourneys, setLoadingJourneys] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [missions, setMissions] = useState<{ id: string; title: string; status: string }[]>([]);
  const [missionBusy, setMissionBusy] = useState<string | null>(null);
  const [missionLoading, setMissionLoading] = useState(false);

  async function readApiJson(response: Response, action: string): Promise<Record<string, any>> {
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("application/json")) {
      throw new Error(action + ": o servidor retornou uma página em vez de dados. Atualize a sessão e tente novamente.");
    }
    let payload: unknown;
    try { payload = await response.json(); }
    catch { throw new Error(action + ": resposta JSON inválida."); }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new Error(action + ": resposta inesperada do servidor.");
    }
    return payload as Record<string, any>;
  }

  async function openJourney(id: string) {
    if (expandedId === id) { setExpandedId(null); return; }
    setMissionLoading(true);
    setExpandedId(id);
    setMissions([]);
    try {
      const response = await fetch("/api/journeys/" + encodeURIComponent(id), { cache: "no-store" });
      const payload = await readApiJson(response, "Não foi possível processar a jornada");
      if (!response.ok) throw new Error(payload.error || "Falha ao consultar missões.");
      setMissions(payload.missions);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao consultar missões.");
      setExpandedId(null);
    } finally {
      setMissionLoading(false);
    }
  }

  async function toggleMission(id: string, status: string) {
    if (!expandedId || missionBusy) return;
    setMissionBusy(id);
    setMessage("");
    try {
      const response = await fetch("/api/journeys/" + encodeURIComponent(expandedId) +
        "/missions/" + encodeURIComponent(id), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: status === "completed" ? "pending" : "completed" }),
      });
      const payload = await readApiJson(response, "Não foi possível processar a jornada");
      if (!response.ok) throw new Error(payload.error || "Falha ao atualizar missão.");
      setMissions((current) => current.map((mission) =>
        mission.id === id ? { ...mission, status: payload.mission.status } : mission));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao atualizar missão.");
    } finally {
      setMissionBusy(null);
    }
  }

  async function refreshJourneys() {
    try {
      const response = await fetch("/api/journeys", { cache: "no-store" });
      if (!response.ok) throw new Error("Falha ao carregar jornadas");
      const payload = await readApiJson(response, "Não foi possível processar a jornada");
      setJourneys(payload.journeys);
    } catch {
      setMessage("Não foi possível carregar suas jornadas.");
    } finally {
      setLoadingJourneys(false);
    }
  }

  useEffect(() => {
    let active = true;
    fetch("/api/journeys", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Falha ao carregar jornadas");
        return readApiJson(response, "Não foi possível carregar as jornadas");
      })
      .then((payload) => { if (active) setJourneys(payload.journeys); })
      .catch(() => { if (active) setMessage("Não foi possível carregar suas jornadas."); })
      .finally(() => { if (active) setLoadingJourneys(false); });
    return () => { active = false; };
  }, []);


  async function submit(confirm: boolean) {
    if (submittingRef.current || (confirm && saved)) return;
    submittingRef.current = true;
    setBusy(true);
    setMessage("");
    if (confirm && !confirmationKeyRef.current) confirmationKeyRef.current = crypto.randomUUID();
    try {
      const response = await fetch(confirm ? "/api/journeys/confirm" : useAI ? "/api/journeys/ai-preview" : "/api/journeys/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title, ...(targetDate ? { targetDate } : {}),
          weeklyAvailabilityDays: days,
          ...(confirm ? { confirmed: true, confirmationKey: confirmationKeyRef.current, plannedOn: draft?.plannedOn, ...(snapshotId ? { snapshotId } : {}) } : {}),
        }),
      });
      let payload = await readApiJson(response, "Não foi possível processar a jornada");
      // A falha da IA não pode impedir o usuário de criar uma jornada básica.
      if (!confirm && useAI && (response.status === 429 || response.status === 503)) {
        const fallback = await fetch("/api/journeys/draft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, ...(targetDate ? { targetDate } : {}), weeklyAvailabilityDays: days }),
        });
        const fallbackPayload = await readApiJson(fallback, "Não foi possível criar a prévia alternativa");
        if (fallback.ok) {
          setDraft(fallbackPayload.draft);
          setSnapshotId(null);
          setSaved(false);
          setMessage("A personalização com IA está temporariamente indisponível. Preparamos uma jornada automática para você revisar e salvar agora.");
          return;
        }
        payload = fallbackPayload;
        if (fallback.status === 429) {
          setMessage("A criação automática está temporariamente ocupada. Aguarde um instante e tente novamente.");
          return;
        }
        throw new Error(payload.error || "Não foi possível criar a jornada automática.");
      }
      if (!response.ok) {
        if (response.status === 429) {
          const retrySeconds = Number(response.headers.get("Retry-After"));
          const wait = Number.isFinite(retrySeconds) && retrySeconds > 0
            ? ` Tente novamente em aproximadamente ${Math.ceil(retrySeconds / 60)} minuto(s).`
            : " Aguarde antes de tentar novamente.";
          throw new Error((payload.error || "Limite de requisições atingido.") + wait);
        }
        throw new Error(payload.error || "Não foi possível processar sua jornada.");
      }
      if (confirm) {
        setSaved(true);
        setMessage("Jornada salva com sucesso.");
        await refreshJourneys();
      } else {
        setDraft(payload.draft);
        setSnapshotId(typeof payload.snapshotId === "string" ? payload.snapshotId : null);
        setSaved(false);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ocorreu um erro.");
    } finally {
      submittingRef.current = false;
      setBusy(false);
    }
  }

  function resetDraft() {
    confirmationKeyRef.current = null;
    setDraft(null);
    setSnapshotId(null);
    setSaved(false);
    setMessage("");
  }

  return (
    <section className="rounded-2xl border border-violet-400/25 bg-slate-900/75 p-4 text-white" aria-label="Minha jornada com a MIKA">
      <h3 className="text-lg font-semibold">Sua trilha inteligente</h3>
      <p className="mt-1 text-sm text-slate-300">Escolha um sonho. A MIKA prepara um primeiro plano para você revisar.</p>
      <form className="mt-4 space-y-3" onSubmit={(event) => { event.preventDefault(); if (!busy && !draft) void submit(false); }}>
        <label className="block text-sm">Meu objetivo
          <input required maxLength={120} value={title} onChange={(e) => { setTitle(e.target.value); resetDraft(); }}
            placeholder="Ex.: aprender italiano" className="mt-1 w-full rounded-lg border border-white/20 bg-slate-950 p-3 text-white" />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">Data-alvo (opcional)
            <input type="date" value={targetDate} onChange={(e) => { setTargetDate(e.target.value); resetDraft(); }}
              className="mt-1 w-full rounded-lg border border-white/20 bg-slate-950 p-3 text-white" />
          </label>
          <label className="block text-sm">Dias disponíveis por semana
            <select value={days} onChange={(e) => { setDays(Number(e.target.value)); resetDraft(); }}
              className="mt-1 w-full rounded-lg border border-white/20 bg-slate-950 p-3 text-white">
              {[1, 2, 3, 4, 5, 6, 7].map((n) => <option key={n} value={n}>{n} dia{n > 1 ? "s" : ""}</option>)}
            </select>
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-200">
          <input type="checkbox" checked={useAI} onChange={(e) => { setUseAI(e.target.checked); resetDraft(); }} disabled={busy} />
          Personalizar com a MIKA (IA, até 12 semanas)
        </label>
        {!draft && <button type="submit" disabled={busy} className="rounded-lg bg-violet-600 px-4 py-2 font-semibold disabled:opacity-50">
          {busy ? "Preparando..." : "Criar prévia"}
        </button>}
      </form>
      {draft && !saved && <div className="mt-4 space-y-3 rounded-xl border border-white/15 p-3">
        <p className="font-semibold">{draft.title} · {draft.weeks} semana(s)</p>
        <p className="text-xs text-slate-300">{snapshotId ? "Proposta personalizada pela MIKA. Prévia válida por 15 minutos; revise antes de confirmar." : "Proposta inicial automática, ainda não personalizada por IA. Revise antes de confirmar."}</p>
        <ol className="max-h-64 list-decimal space-y-1 overflow-auto pl-5 text-sm">
          {draft.missions.map((mission) => <li key={mission.id}>Semana {mission.week}: {mission.title}</li>)}
        </ol>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={() => void submit(true)}
            className="rounded-lg bg-violet-600 px-4 py-2 font-semibold disabled:opacity-50">
            {busy ? "Salvando..." : "Confirmar e salvar"}
          </button>
          <button type="button" disabled={busy} onClick={resetDraft}
            className="rounded-lg border border-white/30 px-4 py-2">Editar objetivo</button>
        </div>
      </div>}
      {message && <p role="status" className="mt-3 text-sm">{message}</p>}
      <div className="mt-5 border-t border-white/15 pt-4">
        <h4 className="font-semibold">Minhas jornadas</h4>
        {loadingJourneys ? <p className="mt-2 text-sm text-slate-300">Carregando...</p> :
          journeys.length === 0 ? <p className="mt-2 text-sm text-slate-300">Nenhuma jornada cadastrada.</p> :
          <ul className="mt-2 space-y-2">
            {journeys.map((journey) => (
              <li key={journey.id} className="rounded-lg border border-white/15 p-3 text-sm">
                <p className="font-medium">{journey.title}</p>
                <p className="mt-1 text-xs text-slate-300">Status: {journey.status}
                  {journey.target_date ? " · Meta: " + journey.target_date : ""}
                </p>
                <button type="button" onClick={() => void openJourney(journey.id)}
                  className="mt-2 rounded-lg border border-white/30 px-3 py-1.5 text-xs">
                  {expandedId === journey.id ? "Fechar missões" : "Ver missões"}
                </button>
                {expandedId === journey.id && (
                  <div className="mt-3 space-y-2">
                    {missionLoading ? <p className="text-slate-300">Carregando missões...</p> :
                      <>
                        <p className="text-xs text-slate-300">
                          {missions.filter((m) => m.status === "completed").length} de {missions.length} missões concluídas
                        </p>
                        <progress aria-label="Progresso da jornada" className="w-full"
                          max={Math.max(1, missions.length)}
                          value={missions.filter((m) => m.status === "completed").length} />
                        <ul className="max-h-64 space-y-2 overflow-auto">
                          {missions.map((mission) => (
                            <li key={mission.id} className="flex items-start gap-2">
                              <input type="checkbox" className="mt-1"
                                aria-label={"Concluir missão: " + mission.title}
                                checked={mission.status === "completed"}
                                disabled={missionBusy !== null}
                                onChange={() => void toggleMission(mission.id, mission.status)} />
                              <span className={mission.status === "completed" ? "text-slate-400 line-through" : ""}>
                                {mission.title}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </>
                    }
                  </div>
                )}
              </li>
            ))}
          </ul>}
      </div>
    </section>
  );
}
