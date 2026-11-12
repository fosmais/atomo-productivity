"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Message = { role: "user" | "assistant"; content: string };
type Journey = { id: string; title: string; status: string };
type Lesson = { title: string; objective: string; durationMinutes: number; activities: string[]; assessment: string };

export default function MikaProfessorPage() {
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [journeyId, setJourneyId] = useState("");
  const [topic, setTopic] = useState("");
  const [level, setLevel] = useState("iniciante");
  const [durationMinutes, setDurationMinutes] = useState(20);
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
  async function propose() {
    if (!journeyId || busy) return;
    setBusy(true); setError(""); setLesson(null); setMessages([]); setAnswer("");
    try {
      const response = await fetch("/api/mika/lessons/propose", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ journeyId, topic, level, durationMinutes }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Não foi possível preparar a aula.");
      setLesson(json.lesson);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao preparar a aula.");
    } finally { setBusy(false); }
  }
  async function sendMessage() {
    const message = answer.trim();
    if (!lesson || !journeyId || !message || chatBusy || message.length > 2000) return;
    const prior = messages.slice(-12);
    setChatBusy(true); setError(""); setAnswer("");
    try {
      const response = await fetch("/api/mika/lessons/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ journeyId, topic, level, message, history: prior }),
      });
      const json = await response.json();
      if (!response.ok || typeof json.reply !== "string") throw new Error(json.error || "Não foi possível responder.");
      setMessages((current) => [...current, { role: "user", content: message }, { role: "assistant", content: json.reply }]);
    } catch (e) {
      setAnswer(message);
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
          <p className="mt-2 text-sm text-slate-300">Prepare uma aula personalizada a partir de uma jornada. Nenhuma aula será agendada automaticamente.</p>
        </header>
        <section className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5">
          <label className="block text-sm">Jornada
            <select value={journeyId} onChange={(e) => { setJourneyId(e.target.value); setLesson(null); setMessages([]); }} className="mt-1 w-full rounded-lg bg-slate-800 p-3">
              <option value="">Escolha uma jornada ativa</option>
              {journeys.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
            </select>
          </label>
          <label className="block text-sm">Assunto da aula
            <input value={topic} onChange={(e) => { setTopic(e.target.value); setLesson(null); setMessages([]); }} maxLength={120} placeholder="Ex.: cumprimentos em italiano" className="mt-1 w-full rounded-lg bg-slate-800 p-3" />
          </label>
          <label className="block text-sm">Nível
            <select value={level} onChange={(e) => { setLevel(e.target.value); setLesson(null); setMessages([]); }} className="mt-1 w-full rounded-lg bg-slate-800 p-3">
              <option value="iniciante">Iniciante</option><option value="intermediário">Intermediário</option><option value="avançado">Avançado</option>
            </select>
          </label>
          <label className="block text-sm">Duração
            <select value={durationMinutes} onChange={(e) => { setDurationMinutes(Number(e.target.value)); setLesson(null); setMessages([]); }} className="mt-1 w-full rounded-lg bg-slate-800 p-3">
              <option value={15}>15 minutos</option><option value={20}>20 minutos</option><option value={30}>30 minutos</option><option value={45}>45 minutos</option><option value={60}>60 minutos</option>
            </select>
          </label>
          <button type="button" onClick={propose} disabled={!journeyId || busy} className="w-full rounded-xl bg-violet-600 p-3 font-semibold disabled:opacity-50">
            {busy ? "Preparando..." : "Preparar minha aula"}
          </button>
          {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
        </section>
        {lesson && <section className="space-y-3 rounded-2xl border border-violet-400/30 p-5" aria-live="polite">
          <h2 className="text-lg font-semibold">{lesson.title}</h2>
          <p className="text-sm text-slate-300">{lesson.objective} · {lesson.durationMinutes} minutos</p>
          <ol className="list-inside list-decimal space-y-2 text-sm">{lesson.activities.map((a, i) => <li key={i}>{a}</li>)}</ol>
          <p className="text-sm text-violet-200">{lesson.assessment}</p>
          <p className="text-xs text-slate-400">A conversa é interativa, mas não salva progresso nem agenda compromissos.</p>
        </section>}
        {lesson && <section className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-5">
          <h2 className="font-semibold">Conversar com a MIKA Professora</h2>
          <p className="text-xs text-slate-400">As mensagens desta aula ficam apenas nesta sessão da tela e não são salvas como histórico de aprendizagem.</p>
          <div className="max-h-80 space-y-2 overflow-y-auto" aria-live="polite">
            {messages.map((m, i) => <div key={i} className={m.role === "user" ? "rounded-xl bg-violet-800/50 p-3 text-sm" : "rounded-xl bg-slate-800 p-3 text-sm whitespace-pre-wrap"}>
              <strong>{m.role === "user" ? "Você" : "MIKA"}</strong><p className="mt-1">{m.content}</p>
            </div>)}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); void sendMessage(); }} className="space-y-2">
            <label htmlFor="mika-lesson-answer" className="block text-sm">Sua resposta ou pergunta</label>
            <textarea id="mika-lesson-answer" value={answer} onChange={(e) => setAnswer(e.target.value)} maxLength={2000} rows={3} className="w-full rounded-lg bg-slate-800 p-3" placeholder="Peça uma explicação ou responda ao exercício..." />
            <button type="submit" disabled={!answer.trim() || chatBusy} className="w-full rounded-xl bg-violet-600 p-3 font-semibold disabled:opacity-50">{chatBusy ? "MIKA está respondendo..." : "Enviar para a MIKA"}</button>
          </form>
        </section>}
      </div>
    </main>
  );
}
