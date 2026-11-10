"use client";

import { useEffect, useState } from "react";
type SavedJourneySummary = { id: string; title: string; status: string; target_date: string | null };
import type { JourneyDraft } from "@/lib/journey/create-journey-draft";

export default function MikaJourneyPlanner() {
  const [title, setTitle] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [days, setDays] = useState(3);
  const [draft, setDraft] = useState<JourneyDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [saved, setSaved] = useState(false);
  const [journeys, setJourneys] = useState<SavedJourneySummary[]>([]);
  const [loadingJourneys, setLoadingJourneys] = useState(true);

  async function refreshJourneys() {
    try {
      const response = await fetch("/api/journeys", { cache: "no-store" });
      if (!response.ok) throw new Error("Falha ao carregar jornadas");
      const payload = await response.json();
      setJourneys(payload.journeys);
    } catch {
      setMessage("Não foi possível carregar suas jornadas.");
    } finally {
      setLoadingJourneys(false);
    }
  }

  useEffect(() => { void refreshJourneys(); }, []);


  async function submit(confirm: boolean) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(confirm ? "/api/journeys/confirm" : "/api/journeys/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title, ...(targetDate ? { targetDate } : {}),
          weeklyAvailabilityDays: days,
          ...(confirm ? { confirmed: true } : {}),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Não foi possível processar sua jornada.");
      if (confirm) {
        setSaved(true);
        setMessage("Jornada salva com sucesso.");
        await refreshJourneys();
      } else {
        setDraft(payload.draft);
        setSaved(false);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ocorreu um erro.");
    } finally {
      setBusy(false);
    }
  }

  function resetDraft() {
    setDraft(null);
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
        {!draft && <button type="submit" disabled={busy} className="rounded-lg bg-violet-600 px-4 py-2 font-semibold disabled:opacity-50">
          {busy ? "Preparando..." : "Criar prévia"}
        </button>}
      </form>
      {draft && !saved && <div className="mt-4 space-y-3 rounded-xl border border-white/15 p-3">
        <p className="font-semibold">{draft.title} · {draft.weeks} semana(s)</p>
        <p className="text-xs text-slate-300">Proposta inicial automática, ainda não personalizada por IA. Revise antes de confirmar.</p>
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
              </li>
            ))}
          </ul>}
      </div>
    </section>
  );
}
