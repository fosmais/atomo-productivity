"use client";

import { useEffect, useRef, useState } from "react";
type SavedJourneySummary = { id: string; title: string; status: string; target_date: string | null };
import type { JourneyDraft } from "@/lib/journey/create-journey-draft";
import { getCloudEvents } from "@/lib/event-cloud";
import { createClient } from "@/lib/supabase/client";

export default function MikaJourneyPlanner() {
  const [title, setTitle] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [days, setDays] = useState(3);
  const [draft, setDraft] = useState<JourneyDraft | null>(null);
  const [useAI, setUseAI] = useState(true);
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
  const [lessonMissionId, setLessonMissionId] = useState<string | null>(null);
  const [lessonTurns, setLessonTurns] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [lessonInput, setLessonInput] = useState("");
  const [lessonBusy, setLessonBusy] = useState(false);
  const lessonScrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const panel = lessonScrollRef.current;
    if (panel) panel.scrollTop = panel.scrollHeight;
  }, [lessonTurns]);
  const [scheduleMissionId, setScheduleMissionId] = useState<string | null>(null);
  const [scheduleStart, setScheduleStart] = useState("");
  const [scheduleBusy, setScheduleBusy] = useState(false);
  const [editingJourney, setEditingJourney] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDate, setEditDate] = useState("");
  const [journeyBusy, setJourneyBusy] = useState<string | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return payload as Record<string, any>;
  }

  const journeyOpenRequestRef = useRef(0);
  const lessonRequestRef = useRef(0);
  const pendingMissionScrollRef = useRef<string | null>(null);

  async function openJourney(id: string) {
    const requestId = ++journeyOpenRequestRef.current;
    ++lessonRequestRef.current;
    setLessonBusy(false);
    if (expandedId === id) { setExpandedId(null); setLessonMissionId(null); setScheduleMissionId(null); return; }
    setMissionLoading(true);
    setExpandedId(id);
    setMissions([]);
    setLessonMissionId(null);
    setLessonTurns([]);
    setLessonInput("");
    setScheduleMissionId(null);
    setScheduleStart("");
    try {
      const response = await fetch("/api/journeys/" + encodeURIComponent(id), { cache: "no-store" });
      const payload = await readApiJson(response, "Não foi possível processar a jornada");
      if (requestId !== journeyOpenRequestRef.current) return;
      if (!response.ok) throw new Error(payload.error || "Falha ao consultar missões.");
      if (!Array.isArray(payload.missions)) throw new Error("A jornada não retornou uma lista válida de missões. Tente novamente.");
      setMissions(payload.missions);
    } catch (error) {
      if (requestId !== journeyOpenRequestRef.current) return;
      setMessage(error instanceof Error ? error.message : "Falha ao consultar missões.");
      setExpandedId(null);
    } finally {
      if (requestId === journeyOpenRequestRef.current) setMissionLoading(false);
    }
  }

  async function talkToMika(journeyId: string, missionId: string, answer?: string) {
    if (lessonBusy) return;
    const requestId = ++lessonRequestRef.current;
    setLessonBusy(true);
    setMessage("");
    // Reset the visible conversation before requesting a new mission's first lesson.
    if (!answer) {
      setLessonMissionId(missionId);
      setLessonTurns([]);
      setLessonInput("");
    }
    const next = answer ? [...lessonTurns, { role: "user" as const, content: answer }] : [];
    try {
      const response = await fetch("/api/journeys/" + encodeURIComponent(journeyId) + "/mika-session", {
        method: "POST", headers: { "Content-Type": "application/json" },
        // Keep the opening MIKA exercise in the first follow-up so the tutor
        // knows which question the learner answered. Retain 12 recent turns.
        body: JSON.stringify({
          missionId,
          messages: next.slice(-12),
        }),
      });
      const payload = await readApiJson(response, "Aula com a MIKA");
      if (requestId !== lessonRequestRef.current) return;
      if (!response.ok || typeof payload.reply !== "string" || !payload.reply.trim() || payload.missionId !== missionId) throw new Error(payload.error || "Resposta da MIKA inválida para esta missão.");
      setLessonMissionId(missionId);
      setLessonTurns([...next, { role: "assistant", content: payload.reply }]);
      setLessonInput("");
    } catch (error) {
      if (requestId !== lessonRequestRef.current) return;
      // Preserve the student's typed answer when a network or AI request fails.
      if (answer) setLessonInput(answer);
      setMessage(error instanceof Error ? error.message : "Falha ao iniciar a aula.");
    } finally { if (requestId === lessonRequestRef.current) setLessonBusy(false); }
  }

  async function scheduleJourneyLesson(journeyId: string, missionId: string, missionTitle: string) {
    if (scheduleBusy) return;
    const start = new Date(scheduleStart);
    const end = new Date(start.getTime() + 20 * 60_000);
    if (!scheduleStart || Number.isNaN(start.getTime()) || start.getTime() < Date.now() + 60_000) {
      setMessage("Escolha uma data e horário futuros para a aula.");
      return;
    }
    setScheduleBusy(true);
    setMessage("");
    try {
      const events = await getCloudEvents();
      const missionMarker = "Jornada " + journeyId + " · missão " + missionId + ".";
      if (events.some(event => event.notes?.startsWith(missionMarker))) {
        throw new Error("Esta missão já possui uma aula na Agenda. Abra a Agenda para consultar ou ajustar o compromisso.");
      }
      const conflict = events.some(event => event.blocksTime && new Date(event.startsAt).getTime() < end.getTime() &&
        new Date(event.endsAt).getTime() > start.getTime());
      if (conflict) throw new Error("Já existe um compromisso nesse período. Escolha outro horário.");
      if (!window.confirm(`Confirmar aula "${missionTitle}" na Agenda MYRYRA em ${start.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}, com duração de 20 minutos?`)) return;
      // Refresh after confirmation: the user may have changed the calendar while the dialog was open.
      if (start.getTime() < Date.now() + 60_000) {
        throw new Error("O horário selecionado já está muito próximo ou passou. Escolha outro horário.");
      }
      const latest = await getCloudEvents();
      if (latest.some(event => event.notes?.startsWith(missionMarker))) {
        throw new Error("Esta missão já foi agendada. Confira o compromisso na Agenda.");
      }
      if (latest.some(event => event.blocksTime && new Date(event.startsAt).getTime() < end.getTime() &&
        new Date(event.endsAt).getTime() > start.getTime())) {
        throw new Error("A Agenda mudou e o horário está ocupado. Escolha outro horário.");
      }
      // The database RPC serializes bookings and checks mission ownership, conflicts and duplicates atomically.
      const { data: bookedEventId, error: bookingError } = await createClient().rpc("myryra_book_journey_lesson", {
        p_journey_id: journeyId,
        p_mission_id: missionId,
        p_starts_at: start.toISOString(),
      });
      if (bookingError) {
        if (bookingError.code === "23505") throw new Error("Esta missão já foi agendada.");
        if (bookingError.code === "23P01") throw new Error("O horário está ocupado. Escolha outro.");
        if (bookingError.code === "55P03" || bookingError.code === "40P01") throw new Error("A Agenda está recebendo alterações. Aguarde alguns segundos e tente novamente.");
        if (bookingError.code === "P0002") throw new Error("A missão não está mais disponível. Atualize a Journey.");
        if (bookingError.code === "22023") throw new Error("O horário selecionado não é válido. Escolha outra data.");
        if (bookingError.code === "PGRST202" || bookingError.code === "42883") {
          throw new Error("O agendamento da Journey ainda não está disponível neste ambiente. Nenhum compromisso foi criado.");
        }
        throw new Error("Não foi possível confirmar a aula na Agenda. Tente novamente.");
      }
      if (typeof bookedEventId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(bookedEventId)) {
        throw new Error("Não foi possível confirmar o identificador do compromisso. Consulte a Agenda antes de tentar novamente para evitar duplicidade.");
      }
      setMessage("Aula criada na Agenda MYRYRA. Abra a Agenda para visualizar o compromisso. Google Calendar não foi sincronizado.");
      setScheduleMissionId(null);
      setScheduleStart("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível agendar a aula.");
    } finally { setScheduleBusy(false); }
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
      if (payload.mission.status === "completed") {
        if (lessonMissionId === id) { setLessonMissionId(null); setLessonTurns([]); setLessonInput(""); }
        if (scheduleMissionId === id) { setScheduleMissionId(null); setScheduleStart(""); }
      }
      setMissions((current) => current.map((mission) =>
        mission.id === id ? { ...mission, status: payload.mission.status } : mission));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao atualizar missão.");
    } finally {
      setMissionBusy(null);
    }
  }

  async function toggleJourneyPause(id: string, status: string) {
    if (journeyBusy || (status !== "active" && status !== "paused")) return;
    setJourneyBusy(id);
    setMessage("");
    try {
      const response = await fetch("/api/journeys/" + encodeURIComponent(id), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: status === "active" ? "paused" : "active" }),
      });
      const payload = await readApiJson(response, "Não foi possível alterar o estado da meta");
      if (!response.ok) throw new Error(payload.error || "Falha ao atualizar a meta.");
      setMessage(status === "active" ? "Jornada pausada. Seu progresso foi preservado." : "Jornada retomada de onde parou.");
      await refreshJourneys();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao atualizar a meta.");
    } finally {
      setJourneyBusy(null);
    }
  }

  async function changeJourneyStatus(id: string, status: "active" | "paused") {
    if (journeyBusy) return;
    setJourneyBusy(id);
    setMessage("");
    try {
      const response = await fetch("/api/journeys/" + encodeURIComponent(id), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const payload = await readApiJson(response, "Não foi possível alterar o status da meta");
      if (!response.ok) throw new Error(payload.error || "Falha ao alterar o status da meta.");
      setMessage(status === "paused" ? "Meta pausada. Seu progresso foi preservado." : "Meta retomada. Seu progresso foi preservado.");
      await refreshJourneys();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao alterar o status da meta.");
    } finally {
      setJourneyBusy(null);
    }
  }

  async function changeSavedJourney(id: string, archive: boolean) {
    if (journeyBusy) return;
    if (archive && !window.confirm("Remover esta meta da lista? O histórico e os MYRAs serão preservados.")) return;
    setJourneyBusy(id);
    setMessage("");
    try {
      const response = await fetch("/api/journeys/" + encodeURIComponent(id), {
        method: archive ? "DELETE" : "PATCH",
        ...(archive ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: editTitle, targetDate: editDate || null }) }),
      });
      const payload = await readApiJson(response, "Não foi possível atualizar a meta");
      if (!response.ok) throw new Error(payload.error || "Falha ao atualizar meta.");
      setMessage(payload.message || "Meta atualizada.");
      setEditingJourney(null);
      if (archive && expandedId === id) { setExpandedId(null); setMissions([]); }
      await refreshJourneys();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao atualizar meta.");
    } finally {
      setJourneyBusy(null);
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

  // A booked lesson may link here from Agenda. Resolve only missions owned by the
  // authenticated user through the existing Journey API; never trust URL IDs as data.
  useEffect(() => {
    const url = new URL(window.location.href);
    const journeyId = url.searchParams.get("journey");
    const missionId = url.searchParams.get("mission");
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!journeyId || !uuid.test(journeyId) || (missionId !== null && !uuid.test(missionId))) return;
    url.searchParams.delete("journey");
    url.searchParams.delete("mission");
    window.history.replaceState(window.history.state, "", url.toString());
    const requestId = ++journeyOpenRequestRef.current;
    ++lessonRequestRef.current;
    let active = true;
    // Defer the URL-driven UI update to the async fetch continuation.
    fetch("/api/journeys/" + encodeURIComponent(journeyId), { cache: "no-store" })
      .then(async response => {
        const payload = await readApiJson(response, "Abrir missão da Agenda");
        if (!response.ok) throw new Error(payload.error || "Não foi possível abrir a jornada.");
        return payload;
      })
      .then(payload => {
        if (!active || requestId !== journeyOpenRequestRef.current) return;
        const list = Array.isArray(payload.missions) ? payload.missions : [];
        setExpandedId(journeyId);
        setMissions(list);
        if (missionId === null) {
          setMessage("Jornada aberta. Escolha sua próxima missão para continuar.");
          document.getElementById("myryra-saved-journeys")?.scrollIntoView({ block: "start", behavior: "smooth" });
        } else if (list.some((mission: { id: string }) => mission.id === missionId)) {
          setMessage("Missão localizada. Selecione Iniciar com a MIKA para começar sua aula.");
          pendingMissionScrollRef.current = missionId;
        } else {
          setMessage("A missão do compromisso não está disponível nesta jornada.");
        }
      })
      .catch(error => {
        if (active && requestId === journeyOpenRequestRef.current) {
          setMessage(error instanceof Error ? error.message : "Não foi possível abrir a missão.");
          setExpandedId(null);
        }
      })
      .finally(() => { if (active && requestId === journeyOpenRequestRef.current) setMissionLoading(false); });
    return () => { active = false; };
  }, []);

  // Scroll only after React has rendered the mission returned by the Journey API.
  useEffect(() => {
    const missionId = pendingMissionScrollRef.current;
    if (!missionId || missionLoading || !missions.some(mission => mission.id === missionId)) return;
    const element = document.getElementById("journey-mission-" + missionId);
    if (!element) return;
    pendingMissionScrollRef.current = null;
    element.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [missions, missionLoading]);

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
      // An AI endpoint can fail with an HTML error page. Recover to the basic
      // draft only when the AI preview failed; never retry confirmation writes.
      const isJson = (response.headers.get("content-type") ?? "").toLowerCase().includes("application/json");
      const aiUnavailable = !confirm && useAI && (!isJson || response.status === 429 || response.status === 503);
      let payload = aiUnavailable ? {} : await readApiJson(response, "Não foi possível processar a jornada");
      // A falha da IA não pode impedir o usuário de criar uma jornada básica.
      if (aiUnavailable) {
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
        if (typeof payload.journey?.id !== "string") throw new Error("A jornada foi salva, mas não foi possível identificá-la. Atualize a página para encontrá-la.");
        setSaved(true);
        setMessage("Jornada salva com sucesso. Abra sua jornada para iniciar as missões.");
        window.dispatchEvent(new CustomEvent("myryra:journey-created", { detail: { journeyId: payload.journey.id } }));
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
          Personalizar com a MIKA (recomendado, até 12 semanas)
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
      {message && <div role="status" className="mt-3 space-y-2 text-sm"><p>{message}</p>{message.startsWith("Aula criada na Agenda MYRYRA.") && <a href="/dashboard#vyra-calendar" className="inline-flex rounded-lg border border-violet-400/60 px-3 py-2 font-semibold text-violet-200 underline underline-offset-2">Abrir minha Agenda</a>}</div>}
      <div className="mt-5 border-t border-white/15 pt-4">
        <h4 id="myryra-saved-journeys" className="font-semibold">Minhas jornadas</h4>
        {loadingJourneys ? <p className="mt-2 text-sm text-slate-300">Carregando...</p> :
          journeys.length === 0 ? <p className="mt-2 text-sm text-slate-300">Nenhuma jornada cadastrada.</p> :
          <ul className="mt-2 space-y-2">
            {journeys.map((journey) => (
              <li key={journey.id} className="rounded-lg border border-white/15 p-3 text-sm">
                <p className="font-medium">{journey.title}</p>
                <p className="mt-1 text-xs text-slate-300">Status: {journey.status === "active" ? "Em andamento" : journey.status === "paused" ? "Pausada" : journey.status === "completed" ? "Concluída" : journey.status === "archived" ? "Arquivada" : journey.status}
                  {journey.target_date ? " · Meta: " + journey.target_date.slice(0, 10).split("-").reverse().join("/") : ""}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <a href={"/journey?journey=" + encodeURIComponent(journey.id)} className="inline-flex rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-500">Abrir minha jornada →</a>
                  {(journey.status === "active" || journey.status === "paused") && (
                    <button type="button" disabled={journeyBusy !== null} onClick={() => void toggleJourneyPause(journey.id, journey.status)}
                      className="rounded-lg border border-amber-400/50 px-3 py-2 text-xs text-amber-100 disabled:opacity-50">
                      {journey.status === "active" ? "Pausar" : "Retomar"}
                    </button>
                  )}
                  <button type="button" disabled={journeyBusy !== null} onClick={() => {
                    setEditingJourney(journey.id);
                    setEditTitle(journey.title);
                    setEditDate(journey.target_date?.slice(0, 10) ?? "");
                  }} className="rounded-lg border border-white/30 px-3 py-2 text-xs disabled:opacity-50">Editar meta</button>
                  {(journey.status === "active" || journey.status === "paused") && (
                    <button type="button" disabled={journeyBusy !== null}
                      onClick={() => void changeJourneyStatus(journey.id, journey.status === "active" ? "paused" : "active")}
                      className="rounded-lg border border-amber-400/40 px-3 py-2 text-xs text-amber-100 disabled:opacity-50">
                      {journeyBusy === journey.id ? "Aguarde..." : journey.status === "active" ? "Pausar meta" : "Retomar meta"}
                    </button>
                  )}
                  <button type="button" disabled={journeyBusy !== null} onClick={() => void changeSavedJourney(journey.id, true)}
                    className="rounded-lg border border-rose-400/50 px-3 py-2 text-xs text-rose-200 disabled:opacity-50">
                    {journeyBusy === journey.id ? "Aguarde..." : "Excluir meta"}
                  </button>
                </div>
                {editingJourney === journey.id && (
                  <div className="mt-3 space-y-2 rounded-lg border border-violet-400/30 p-3">
                    <label className="block text-xs">Nome da meta
                      <input value={editTitle} maxLength={120} onChange={(event) => setEditTitle(event.target.value)}
                        className="mt-1 w-full rounded-lg border border-white/20 bg-slate-950 p-2 text-sm" />
                    </label>
                    <label className="block text-xs">Data-alvo (opcional)
                      <input type="date" value={editDate} onChange={(event) => setEditDate(event.target.value)}
                        className="mt-1 w-full rounded-lg border border-white/20 bg-slate-950 p-2 text-sm" />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" disabled={journeyBusy !== null || !editTitle.trim()} onClick={() => void changeSavedJourney(journey.id, false)}
                        className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold disabled:opacity-50">Salvar alterações</button>
                      <button type="button" disabled={journeyBusy !== null} onClick={() => setEditingJourney(null)}
                        className="rounded-lg border border-white/30 px-3 py-2 text-xs">Cancelar</button>
                    </div>
                  </div>
                )}
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
                        {journey.status === "active" && missions.some((mission) => mission.status === "pending") && (
                          <div className="rounded-xl border border-violet-400/40 bg-violet-500/10 p-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-violet-200">Sua próxima missão</p>
                            <p className="mt-1 font-medium">{missions.find((mission) => mission.status === "pending")?.title}</p>
                            <button type="button" onClick={() => {
                              const next = missions.find((mission) => mission.status === "pending");
                              if (next) document.getElementById("journey-mission-" + next.id)?.scrollIntoView({ behavior: "smooth", block: "center" });
                            }} className="mt-2 rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-500">Ir para próxima missão</button>
                          </div>
                        )}
                        <ul className="max-h-80 space-y-2 overflow-y-auto pr-1">
                          {missions.map((mission) => (
                            <li key={mission.id} id={"journey-mission-" + mission.id} className="flex items-start gap-3 rounded-xl border border-white/15 bg-white/5 p-3">
                              <input type="checkbox" className="mt-1"
                                aria-label={"Concluir missão: " + mission.title}
                                checked={mission.status === "completed"}
                                disabled={missionBusy !== null}
                                onChange={() => void toggleMission(mission.id, mission.status)} />
                              <div className="min-w-0 flex-1">
                                <span className={mission.status === "completed" ? "text-slate-400 line-through" : ""}>
                                  {mission.title}
                                </span>
                                {journey.status === "active" && mission.status === "pending" && <button type="button" disabled={lessonBusy}
                                  onClick={() => {
                                    if (lessonMissionId && lessonTurns.length > 0 &&
                                      !window.confirm(lessonMissionId === mission.id
                                        ? "Reiniciar esta aula? A conversa atual será perdida."
                                        : "Iniciar outra missão? A conversa da aula atual será perdida.")) return;
                                    void talkToMika(journey.id, mission.id);
                                  }}
                                  className="mt-2 block rounded-lg border border-violet-400/60 px-3 py-1.5 text-xs">
                                  {lessonMissionId === mission.id && lessonTurns.length > 0 ? "Reiniciar aula com a MIKA" : "Iniciar com a MIKA"}
                                </button>}
                                {journey.status === "active" && mission.status === "pending" && <button type="button" disabled={scheduleBusy}
                                  onClick={() => setScheduleMissionId(scheduleMissionId === mission.id ? null : mission.id)}
                                  className="mt-2 block rounded-lg border border-white/30 px-3 py-1.5 text-xs">
                                  Agendar aula na Agenda
                                </button>}
                                {scheduleMissionId === mission.id && <div className="mt-2 space-y-2 rounded-lg border border-white/20 p-3">
                                  <label className="block text-xs">Data e horário da aula (20 minutos)
                                    <input type="datetime-local" value={scheduleStart} onChange={(event) => setScheduleStart(event.target.value)}
                                      className="mt-1 block max-w-full rounded-lg border border-white/20 bg-slate-950 p-2 text-sm" />
                                  </label>
                                  <button type="button" disabled={scheduleBusy || !scheduleStart}
                                    onClick={() => void scheduleJourneyLesson(journey.id, mission.id, mission.title)}
                                    className="rounded-lg bg-violet-600 px-3 py-2 text-xs disabled:opacity-50">
                                    {scheduleBusy ? "Agendando..." : "Revisar e confirmar aula"}
                                  </button>
                                </div>}
                                {lessonMissionId === mission.id && <div className="mt-2 space-y-2 rounded-lg border border-violet-400/30 p-3">
                                  <p className="text-xs font-semibold">Aula interativa · MIKA</p>
                                  <div ref={lessonScrollRef} className="max-h-64 space-y-2 overflow-y-auto" aria-live="polite">
                                    {lessonTurns.map((turn, index) => <p key={index} className="text-sm">
                                      <strong>{turn.role === "assistant" ? "MIKA: " : "Você: "}</strong>{turn.content}
                                    </p>)}
                                  </div>
                                  <form onSubmit={(event) => { event.preventDefault(); if (lessonInput.trim()) void talkToMika(journey.id, mission.id, lessonInput.trim()); }}
                                    className="flex flex-wrap gap-2">
                                    <input aria-label="Responder à MIKA" maxLength={1500} disabled={lessonBusy} value={lessonInput}
                                      onChange={(event) => setLessonInput(event.target.value)}
                                      className="min-w-0 flex-1 rounded-lg border border-white/20 bg-slate-950 p-2 text-sm"
                                      placeholder="Escreva sua resposta" />
                                    <button type="submit" disabled={lessonBusy || !lessonInput.trim()}
                                      className="rounded-lg bg-violet-600 px-3 py-2 text-xs disabled:opacity-50">
                                      {lessonBusy ? "Aguarde..." : "Enviar"}
                                    </button>
                                  </form>
                                  {lessonBusy && <p role="status" className="text-xs text-violet-200">MIKA está preparando a resposta...</p>}
                                  <p className="text-xs text-slate-400">A conversa não conclui a missão automaticamente nem concede MYRAs.</p>
                                </div>}
                              </div>
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
