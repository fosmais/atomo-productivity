"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Session = { id: string; journey_id: string | null; mission_id?: string | null; topic: string; level: string; duration_minutes?: number; status: string; created_at: string; scheduled_at?: string | null };
type Message = { role: "user" | "assistant"; content: string };
type Journey = { id: string; title: string; status: string };
type Mission = { id: string; title: string; status: string; due_at: string | null };
type Lesson = { title: string; objective: string; durationMinutes: number; activities: string[]; assessment: string };

function isScheduleWithinRange(selected: string): boolean {
  const timestamp = Date.parse(selected);
  const now = Date.now();
  return Number.isFinite(timestamp) && timestamp >= now + 60000 && timestamp <= now + 366 * 86400000;
}

function downloadCalendarInvite(session: Session) {
  if (!session.scheduled_at) return;
  const start = new Date(session.scheduled_at);
  if (!Number.isFinite(start.getTime())) return;
  const chosen = window.prompt("Duração da aula em minutos (15, 20, 30, 45 ou 60):", String(session.duration_minutes ?? 30));
  if (chosen === null) return;
  const duration = Number(chosen.trim());
  if (!["15", "20", "30", "45", "60"].includes(chosen.trim())) {
    window.alert("Escolha uma duração válida: 15, 20, 30, 45 ou 60 minutos.");
    return;
  }
  const end = new Date(start.getTime() + duration * 60000);
  const stamp = (date: Date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const escapeIcs = (value: string) => value.replace(/\\/g, "\\\\").replace(/\r\n|\r|\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//MYRYRA//MIKA Professora//PT-BR",
    "BEGIN:VEVENT", "UID:" + session.id + "@myryra.com",
    "DTSTAMP:" + stamp(new Date()), "DTSTART:" + stamp(start), "DTEND:" + stamp(end),
    "SUMMARY:" + escapeIcs("Aula com MIKA: " + session.topic),
    "DESCRIPTION:" + escapeIcs("Aula da MIKA Professora. Duração informada pelo usuário: " + duration + " minutos; confirme o horário no calendário."),
    "END:VEVENT", "END:VCALENDAR",
  ];
  const blob = new Blob([lines.join("\r\n") + "\r\n"], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = "mika-aula-" + session.id + ".ics";
  document.body.appendChild(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function MikaProfessorPage() {
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [journeyId, setJourneyId] = useState("");
  const [missions, setMissions] = useState<Mission[]>([]);
  const [missionsBusy, setMissionsBusy] = useState(false);
  const [missionsError, setMissionsError] = useState("");
  const [missionId, setMissionId] = useState("");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [nextHistoryPage, setNextHistoryPage] = useState<number | null>(null);
  const [sessionId, setSessionId] = useState("");
  const [historyError, setHistoryError] = useState("");
  const [saveWarning, setSaveWarning] = useState("");
  const [lastMessageSaved, setLastMessageSaved] = useState(false);
  const [historyOutOfSync, setHistoryOutOfSync] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState("");
  const [historyBusy, setHistoryBusy] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyReady, setHistoryReady] = useState(false);
  const [topic, setTopic] = useState("");
  const [level, setLevel] = useState("iniciante");
  const [durationMinutes, setDurationMinutes] = useState(20);
  const [scheduledAt, setScheduledAt] = useState("");
  const [rescheduleInputs, setRescheduleInputs] = useState<Record<string, string>>({});
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [busy, setBusy] = useState(false);
  const [chatBusy, setChatBusy] = useState(false);
  const [answer, setAnswer] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/journeys", { cache: "no-store", signal: controller.signal })
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error || "Não foi possível carregar suas jornadas.");
        setJourneys((json.journeys ?? []).filter((j: Journey) => j.status === "active"));
      })
      .catch((e) => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Falha ao carregar jornadas."); });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setSessions([]); setNextHistoryPage(null); setSessionId(""); setHistoryError(""); setHistoryReady(false); setHistoryLoading(true);
    });
    fetch("/api/mika/lessons/sessions" + (journeyId ? "?journeyId=" + encodeURIComponent(journeyId) : ""), { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const json = await response.json();
        if (!response.ok) throw new Error(json.error || "Histórico indisponível.");
        if (!controller.signal.aborted) { setSessions(json.sessions ?? []); setNextHistoryPage(typeof json.nextPage === "number" ? json.nextPage : null); setHistoryReady(true); }
      }).catch((e) => { if (!controller.signal.aborted) setHistoryError(e instanceof Error ? e.message : "Histórico indisponível."); })
      .finally(() => { if (!controller.signal.aborted) setHistoryLoading(false); });
    return () => controller.abort();
  }, [journeyId]);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setMissions([]); setMissionId(""); setMissionsError(""); setMissionsBusy(Boolean(journeyId));
    });
    if (!journeyId) return () => controller.abort();
    fetch("/api/mika/lessons/missions?journeyId=" + encodeURIComponent(journeyId), { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const json = await response.json();
        if (!response.ok) throw new Error(json.error || "Missões indisponíveis.");
        if (!controller.signal.aborted) setMissions(json.missions ?? []);
      })
      .catch((error) => { if (!controller.signal.aborted) setMissionsError(error instanceof Error ? error.message : "Missões indisponíveis."); })
      .finally(() => { if (!controller.signal.aborted) setMissionsBusy(false); });
    return () => controller.abort();
  }, [journeyId]);

  async function loadMoreHistory() {
    if (nextHistoryPage === null || historyLoading || historyBusy) return;
    setHistoryBusy(true); setHistoryError("");
    try {
      const params = new URLSearchParams({ page: String(nextHistoryPage) });
      if (journeyId) params.set("journeyId", journeyId);
      const response = await fetch("/api/mika/lessons/sessions?" + params.toString(), { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Não foi possível carregar mais aulas.");
      setSessions((current) => {
        const known = new Set(current.map((item) => item.id));
        return [...current, ...(json.sessions ?? []).filter((item: Session) => !known.has(item.id))];
      });
      setNextHistoryPage(typeof json.nextPage === "number" ? json.nextPage : null);
    } catch (e) { setHistoryError(e instanceof Error ? e.message : "Falha ao carregar mais aulas."); }
    finally { setHistoryBusy(false); }
  }

  async function deleteSession(session: Session) {
    if (historyBusy || chatBusy || busy || !window.confirm("Excluir definitivamente esta aula e todas as mensagens? Esta ação não pode ser desfeita.")) return;
    setHistoryBusy(true); setError("");
    try {
      const response = await fetch("/api/mika/lessons/delete?sessionId=" + encodeURIComponent(session.id), { method: "DELETE" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Não foi possível excluir a aula.");
      setSessions((current) => current.filter((item) => item.id !== session.id));
      if (sessionId === session.id) { setSessionId(""); setLesson(null); setMessages([]); setAnswer(""); setLastMessageSaved(false); }
    } catch (e) { setError(e instanceof Error ? e.message : "Falha ao excluir aula."); }
    finally { setHistoryBusy(false); }
  }

  async function updateSchedule(session: Session, clear = false) {
    if (historyBusy || chatBusy || busy) return;
    const selected = rescheduleInputs[session.id] ?? "";
    if (!clear && (!isScheduleWithinRange(selected))) {
      setError("Escolha uma data válida, entre um minuto e 366 dias a partir de agora."); return;
    }
    setHistoryBusy(true); setError("");
    try {
      const response = await fetch("/api/mika/lessons/schedule", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.id, scheduledAt: clear ? null : new Date(selected).toISOString() }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Não foi possível atualizar o agendamento.");
      setSessions((current) => current.map((item) => item.id === session.id ? { ...item, scheduled_at: json.session.scheduled_at } : item));
      setRescheduleInputs((current) => ({ ...current, [session.id]: "" }));
    } catch (e) { setError(e instanceof Error ? e.message : "Falha ao atualizar agendamento."); }
    finally { setHistoryBusy(false); }
  }

  async function resumeSession(session: Session) {
    if (historyBusy || chatBusy || busy) return;
    setHistoryBusy(true); setError("");
    try {
      const response = await fetch("/api/mika/lessons/messages?sessionId=" + encodeURIComponent(session.id), { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Não foi possível retomar a aula.");
      setTopic(session.topic); setLevel(session.level); setMissionId(session.mission_id ?? ""); setSessionId(session.id); setLastMessageSaved(false); setSaveWarning(""); setHistoryOutOfSync(false); setCopyFeedback("");
      setLesson({ title: "Aula: " + session.topic, objective: "Continuar a aula anterior", durationMinutes, activities: [], assessment: "Continue sua conversa com a MIKA." });
      setMessages((json.messages ?? []).map((m: Message) => ({ role: m.role, content: m.content })));
      setAnswer("");
    } catch (e) { setError(e instanceof Error ? e.message : "Falha ao retomar aula."); }
    finally { setHistoryBusy(false); }
  }

  async function propose() {
    if ((!journeyId && !topic.trim()) || busy || chatBusy || historyBusy || !historyReady) return;
    if (scheduledAt) {
      const time = Date.parse(scheduledAt);
      if (!Number.isFinite(time) || time < Date.now() + 60000 || time > Date.now() + 366 * 86400000) {
        setError("Escolha uma data válida, entre um minuto e 366 dias a partir de agora.");
        return;
      }
    }
    setBusy(true); setError(""); setLastMessageSaved(false); setSaveWarning(""); setHistoryOutOfSync(false); setHistoryError(""); setLesson(null); setMessages([]); setAnswer(""); setSessionId("");
    try {
      const response = await fetch("/api/mika/lessons/propose", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...(journeyId ? { journeyId } : {}), topic, level, durationMinutes }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Não foi possível preparar a aula.");
      setLesson(json.lesson);
      const created = await fetch("/api/mika/lessons/sessions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...(journeyId ? { journeyId } : {}), ...(missionId ? { missionId } : {}), durationMinutes, topic: topic.trim() || journeys.find((j) => j.id === journeyId)?.title || "Aula", level, ...(scheduledAt ? { scheduledAt: new Date(scheduledAt).toISOString() } : {}) }) });
      if (created.ok) { const result = await created.json(); setSessionId(result.session.id); setSessions((previous) => [result.session, ...previous]); }
      else { const failure = await created.json().catch(() => null) as { error?: string } | null; const detail = typeof failure?.error === "string" ? failure.error : "Não foi possível criar a sessão."; setHistoryError(detail); setError(`A aula foi preparada, mas não foi possível iniciar a conversa: ${detail}`); }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao preparar a aula.");
    } finally { setBusy(false); }
  }
  async function sendMessage(initialMessage?: string) {
    const message = (initialMessage ?? answer).trim();
    if (!lesson || !sessionId || !message || chatBusy || historyOutOfSync || message.length > 2000) return;
    setChatBusy(true); setError(""); setLastMessageSaved(false); setSaveWarning(""); setAnswer("");
    try {
      const response = await fetch("/api/mika/lessons/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...(journeyId ? { journeyId } : {}), message, sessionId }),
      });
      const json = await response.json();
      if (!response.ok || typeof json.reply !== "string") throw new Error(json.error || "Não foi possível responder.");
      setMessages((current) => [...current, { role: "user", content: message }, { role: "assistant", content: json.reply }]);
      setLastMessageSaved(json.saved === true);
      if (sessionId && !json.saved) {
        setHistoryOutOfSync(true);
        setSaveWarning(json.warning || "Não foi possível salvar esta resposta no histórico. Copie a resposta antes de sair.");
      }
    } catch (e) {
      if (!initialMessage) setAnswer(message);
      setLastMessageSaved(false);
      setError(e instanceof Error ? e.message : "Falha na conversa.");
    } finally { setChatBusy(false); }
  }
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-white">
      <div className="mx-auto max-w-xl space-y-5">
        <Link href="/journey" className="text-sm text-violet-300">← Voltar à Journey</Link>
        <header className="rounded-2xl border border-violet-400/30 bg-violet-950/40 p-5">
          <p className="text-xs uppercase tracking-widest text-violet-300">MYRYRA · MIKA</p>
          <h1 className="mt-2 text-2xl font-semibold">Sua professora, seu ritmo</h1>
          <p className="mt-2 text-sm text-slate-300">Escolha uma aula livre sobre qualquer assunto ou vincule o aprendizado à sua Journey. Nenhum evento será criado automaticamente.</p>
        </header>
        <section className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5">
          <label className="block text-sm">Modalidade da aula
            <select disabled={chatBusy || busy || historyBusy} value={journeyId} onChange={(e) => { setJourneyId(e.target.value); setMissionId(""); setMissions([]); setMissionsError(""); setLesson(null); setMessages([]); setSessionId(""); setLastMessageSaved(false); }} className="mt-1 w-full rounded-lg bg-slate-800 p-3">
              <option value="">Aula livre (sem Journey)</option>
              {journeys.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
            </select>
          </label>
          {journeyId && <div className="space-y-2">
            <label htmlFor="mika-journey-mission" className="block text-sm">Missão da Journey (opcional)</label>
            <select id="mika-journey-mission" disabled={chatBusy || busy || historyBusy || missionsBusy || Boolean(missionsError)} value={missionId}
              onChange={(e) => {
                const id = e.target.value;
                const mission = missions.find((item) => item.id === id);
                setMissionId(id);
                if (mission) setTopic(mission.title.slice(0, 120));
                setLesson(null); setMessages([]); setSessionId(""); setLastMessageSaved(false);
              }} className="w-full rounded-lg bg-slate-800 p-3">
              <option value="">Escolher assunto livremente</option>
              {missions.filter((m) => m.status === "pending").map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
            </select>
            {missionsBusy && <p className="text-xs text-slate-400">Carregando missões...</p>}
            {missionsError && <p role="alert" className="text-xs text-amber-300">{missionsError}</p>}
            {!missionsBusy && !missionsError && missions.length === 0 && <p className="text-xs text-slate-400">Nenhuma missão cadastrada nesta Journey.</p>}
            <p className="text-xs text-slate-400">Escolher uma missão define o assunto da aula. A aula ficará vinculada à missão selecionada. O progresso da Journey não será atualizado automaticamente.</p>
          </div>}
          <label className="block text-sm">Assunto da aula
            <input disabled={chatBusy || busy || historyBusy} value={topic} onChange={(e) => { setTopic(e.target.value); setMissionId(""); setLesson(null); setMessages([]); setSessionId(""); setLastMessageSaved(false); }} maxLength={120} placeholder="Ex.: cumprimentos em italiano" className="mt-1 w-full rounded-lg bg-slate-800 p-3" />
          </label>
          <label className="block text-sm">Nível
            <select disabled={chatBusy || busy || historyBusy} value={level} onChange={(e) => { setLevel(e.target.value); setLesson(null); setMessages([]); setSessionId(""); setLastMessageSaved(false); }} className="mt-1 w-full rounded-lg bg-slate-800 p-3">
              <option value="iniciante">Iniciante</option><option value="intermediário">Intermediário</option><option value="avançado">Avançado</option>
            </select>
          </label>
          <label className="block text-sm">Duração
            <select disabled={chatBusy || busy || historyBusy} value={durationMinutes} onChange={(e) => { setDurationMinutes(Number(e.target.value)); setLesson(null); setMessages([]); setSessionId(""); setLastMessageSaved(false); }} className="mt-1 w-full rounded-lg bg-slate-800 p-3">
              <option value={15}>15 minutos</option><option value={20}>20 minutos</option><option value={30}>30 minutos</option><option value={45}>45 minutos</option><option value={60}>60 minutos</option>
            </select>
          </label>
          <label className="block text-sm">Agendar para (opcional)
            <input type="datetime-local" disabled={chatBusy || busy || historyBusy} value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="mt-1 w-full rounded-lg bg-slate-800 p-3" />
            <span className="mt-1 block text-xs text-slate-400">Salva a data da aula; ainda não cria evento no calendário nem envia lembrete.</span>
          </label>
          <button type="button" onClick={propose} disabled={(!journeyId && !topic.trim()) || busy || chatBusy || historyBusy || !historyReady || historyLoading} className="w-full rounded-xl bg-violet-600 p-3 font-semibold disabled:opacity-50">
            {busy ? "Preparando..." : "Preparar minha aula"}
          </button>
        </section>
        {error && <p role="alert" className="rounded-lg border border-rose-400/50 p-3 text-sm text-rose-300">{error}</p>}
        {<section className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-5">
          <h2 className="font-semibold">Minhas aulas anteriores</h2>
          {historyError && <p className="text-sm text-amber-300">{historyError}</p>}
          {historyLoading && <p className="text-sm text-slate-400">Carregando aulas...</p>}
          {!historyLoading && !historyError && sessions.length === 0 && <p className="text-sm text-slate-400">Nenhuma aula salva nesta modalidade.</p>}
          {sessions.map((session) => <div key={session.id} className="flex flex-col gap-3 rounded-xl bg-slate-800 p-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0"><p className="truncate text-sm font-medium">{session.topic}</p><p className="text-xs text-slate-400">{new Date(session.created_at).toLocaleDateString("pt-BR")} · {session.status}{session.scheduled_at ? " · Agendada: " + new Date(session.scheduled_at).toLocaleString("pt-BR") : ""}</p></div>
            <div className="flex w-full flex-col gap-2 sm:w-52 sm:shrink-0">
              <label className="text-xs text-slate-300">Reagendar
                <input type="datetime-local" aria-label={"Nova data de " + session.topic} value={rescheduleInputs[session.id] ?? ""} onChange={(e) => setRescheduleInputs((current) => ({ ...current, [session.id]: e.target.value }))} disabled={historyBusy || busy || chatBusy || session.status !== "active"} className="mt-1 w-full rounded-lg bg-slate-700 p-2 text-xs" />
              </label>
              <button type="button" disabled={historyBusy || busy || chatBusy || session.status !== "active" || !rescheduleInputs[session.id]} onClick={() => void updateSchedule(session)} className="rounded-lg border border-violet-400/60 px-3 py-2 text-xs disabled:opacity-40">Salvar horário</button>
              {session.scheduled_at && <><button type="button" onClick={() => downloadCalendarInvite(session)} className="rounded-lg border border-violet-400/60 px-3 py-2 text-xs">Adicionar ao calendário (.ics)</button><p className="text-xs text-amber-200">Importação manual: escolha a duração da aula ao exportar. Se reagendar ou excluir a aula, atualize ou remova também o evento no seu calendário.</p></>}
              {session.scheduled_at && <button type="button" disabled={historyBusy || busy || chatBusy || session.status !== "active"} onClick={() => void updateSchedule(session, true)} className="rounded-lg border border-slate-400/50 px-3 py-2 text-xs disabled:opacity-40">Remover data (manter aula)</button>}
              <button type="button" disabled={historyBusy || busy || chatBusy || session.status !== "active"} onClick={() => void resumeSession(session)} className="rounded-lg border border-violet-400 px-3 py-2 text-sm disabled:opacity-40">Continuar aula</button>
              <button type="button" disabled={historyBusy || busy || chatBusy} onClick={() => void deleteSession(session)} className="rounded-lg border border-rose-400/50 px-3 py-2 text-xs text-rose-200 disabled:opacity-40">Excluir aula</button>
            </div>
          </div>)}
          {nextHistoryPage !== null && <button type="button" disabled={historyBusy || historyLoading} onClick={() => void loadMoreHistory()} className="w-full rounded-lg border border-violet-400/60 p-3 text-sm font-semibold disabled:opacity-40">{historyBusy ? "Carregando..." : "Carregar mais aulas"}</button>}
        </section>}
        {lesson && <section className="space-y-3 rounded-2xl border border-violet-400/30 p-5" aria-live="polite">
          <h2 className="text-lg font-semibold">{lesson.title}</h2>
          <p className="text-sm text-slate-300">{lesson.objective} · {lesson.durationMinutes} minutos</p>
          <ol className="list-inside list-decimal space-y-2 text-sm">{lesson.activities.map((a, i) => <li key={i}>{a}</li>)}</ol>
          <p className="text-sm text-violet-200">{lesson.assessment}</p>
          <p className="text-xs text-slate-400">A conversa é interativa, mas não salva progresso nem agenda compromissos.</p>
        </section>}
        {lesson && <section className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-5">
          <h2 className="font-semibold">Conversar com a MIKA Professora</h2>
          <p className="text-xs text-slate-400">{sessionId ? "Histórico associado à sua conta. A gravação de cada resposta será confirmada pelo servidor." : "Conversa indisponível até que seja possível salvar o histórico da aula."}</p>
          {lastMessageSaved && !saveWarning && <p className="text-xs text-emerald-300" role="status">Resposta e mensagem salvas no histórico desta aula. O progresso pedagógico ainda não é atualizado automaticamente.</p>}
          {saveWarning && <div className="space-y-2 rounded-lg border border-amber-500/50 p-3 text-sm text-amber-200" role="alert">
            <p>{saveWarning} Novas mensagens ficam bloqueadas até você reabrir a aula pelo histórico.</p>
            <button type="button" className="rounded-lg border border-amber-400/60 px-3 py-2 font-semibold" onClick={async () => {
              const lastReply = [...messages].reverse().find((m) => m.role === "assistant")?.content;
              if (!lastReply) return;
              try { await navigator.clipboard.writeText(lastReply); setCopyFeedback("Resposta copiada."); }
              catch { setCopyFeedback("Não foi possível copiar automaticamente. Selecione o texto da resposta para copiar."); }
            }}>Copiar resposta da MIKA</button>
            {copyFeedback && <p role="status">{copyFeedback}</p>}
          </div>}
          <div className="max-h-80 space-y-2 overflow-y-auto" aria-live="polite">
            {messages.map((m, i) => <div key={i} className={m.role === "user" ? "rounded-xl bg-violet-800/50 p-3 text-sm" : "rounded-xl bg-slate-800 p-3 text-sm whitespace-pre-wrap"}>
              <strong>{m.role === "user" ? "Você" : "MIKA"}</strong><p className="mt-1">{m.content}</p>
            </div>)}
          </div>
          {messages.length === 0 && <button type="button" disabled={chatBusy || !sessionId || historyOutOfSync} onClick={() => void sendMessage("MIKA, comece minha aula agora. Apresente o assunto brevemente e faça a primeira pergunta para avaliar meu nível.")} className="w-full rounded-xl border border-violet-400/60 p-3 font-semibold disabled:opacity-50">Começar aula com a MIKA</button>}
          <form onSubmit={(e) => { e.preventDefault(); void sendMessage(); }} className="space-y-2">
            <label htmlFor="mika-lesson-answer" className="block text-sm">Sua resposta ou pergunta</label>
            <textarea id="mika-lesson-answer" value={answer} onChange={(e) => setAnswer(e.target.value)} maxLength={2000} rows={3} className="w-full rounded-lg bg-slate-800 p-3" placeholder="Peça uma explicação ou responda ao exercício..." />
            <button type="submit" disabled={!answer.trim() || chatBusy || !sessionId || historyOutOfSync} className="w-full rounded-xl bg-violet-600 p-3 font-semibold disabled:opacity-50">{chatBusy ? "MIKA está respondendo..." : "Enviar para a MIKA"}</button>
          </form>
        </section>}
      </div>
    </main>
  );
}
