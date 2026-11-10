"use client";

import { useEffect, useState } from "react";
import JourneyAchievementCard from "./journey-achievement-card";

type Journey = { id: string; title: string; status: string; target_date: string | null };
type Mission = { id: string; title: string; status: string; week?: number };
type MyraEntry = { amount: number; created_at: string; mission_id: string; journey_id: string };

export default function JourneyTrail() {
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [selected, setSelected] = useState("");
  const [missions, setMissions] = useState<Mission[]>([]);
  const [myraBalance, setMyraBalance] = useState<number | null>(null);
  const [myraHistory, setMyraHistory] = useState<MyraEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [celebratedMission, setCelebratedMission] = useState<string | null>(null);
  const [earnedMyra, setEarnedMyra] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [goalTitle, setGoalTitle] = useState("");
  const [goalDate, setGoalDate] = useState("");
  const [showAllMissions, setShowAllMissions] = useState(false);
  const [openLesson, setOpenLesson] = useState<string | null>(null);
  const [exerciseAnswers, setExerciseAnswers] = useState<Record<string, string>>({});
  const [showReview, setShowReview] = useState<string | null>(null);
  const [aiFeedback, setAiFeedback] = useState<Record<string, string>>({});
  const [feedbackBusy, setFeedbackBusy] = useState<string | null>(null);
  const [savingExercise, setSavingExercise] = useState<string | null>(null);
  const [exerciseMessage, setExerciseMessage] = useState<Record<string, string>>({});
  const [replan, setReplan] = useState<{ previewOnly: boolean; revision: string; preserved: { completed: { id: string; title: string }[]; existingMissionCount: number }; proposed: { title: string; week: number }[]; planning?: { targetDate: string | null; originalTargetDate: string | null; deadlineNeedsReview: boolean; remainingMissions: number } } | null>(null);
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
      if (Array.isArray(payload.recent)) setMyraHistory(payload.recent);
    } catch { /* Balance can be retried after a mission. */ }
  }
  useEffect(() => {
    const loadBalance = async () => {
      try {
        const response = await fetch("/api/journeys/myra", { cache: "no-store" });
        if (!response.ok) return;
        const payload = await response.json();
        if (typeof payload.balance === "number") setMyraBalance(payload.balance);
        if (Array.isArray(payload.recent)) setMyraHistory(payload.recent);
      } catch { /* Balance remains unavailable until retry. */ }
    };
    void loadBalance();
  }, []);
  async function changeGoal(archive: boolean) {
    if (!selected || busy) return;
    if (archive && !window.confirm("Excluir esta meta da sua lista? O histórico de conquistas e as MYRAs serão preservados.")) return;
    setBusy("goal"); setError("");
    try {
      const response = await fetch("/api/journeys/" + encodeURIComponent(selected), {
        method: archive ? "DELETE" : "PATCH",
        headers: { "Content-Type": "application/json" },
        ...(!archive ? { body: JSON.stringify({ title: goalTitle, targetDate: goalDate || null }) } : {}),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Não foi possível alterar a meta.");
      if (archive) {
        const remaining = journeys.filter(j => j.id !== selected);
        setJourneys(remaining); setSelected(remaining[0]?.id ?? ""); setMissions([]);
      } else {
        setJourneys(old => old.map(j => j.id === selected ? { ...j, ...payload.journey } : j));
      }
      setEditing(false); setReplan(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao alterar a meta."); }
    finally { setBusy(""); }
  }
  async function previewReplan() {
    if (!selected || busy) return;
    setBusy("replan"); setError("");
    try {
      const response = await fetch("/api/journeys/" + encodeURIComponent(selected) + "/replan-preview", { method: "POST", cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Não foi possível preparar a prévia.");
      setReplan(payload);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao preparar a prévia."); }
    finally { setBusy(""); }
  }
  async function applyReplan() {
    if (!selected || busy || !replan || !replan.revision || replan.planning?.deadlineNeedsReview) return;
    if (!window.confirm("Confirmar o novo caminho? Missões concluídas e missões vinculadas serão preservadas. Missões pendentes sem vínculos serão substituídas.")) return;
    setBusy("apply-replan"); setError("");
    try {
      const response = await fetch("/api/journeys/" + encodeURIComponent(selected) + "/replan-apply", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revision: replan.revision }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Não foi possível confirmar o novo caminho.");
      const refreshed = await fetch("/api/journeys/" + encodeURIComponent(selected), { cache: "no-store" });
      if (!refreshed.ok) throw new Error("Novo caminho salvo. Atualize a página para ver suas missões.");
      const data = await refreshed.json();
      setMissions(Array.isArray(data.missions) ? data.missions : []);
      setReplan(null); setShowAllMissions(false);
      void refreshMyra();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao confirmar o replanejamento."); }
    finally { setBusy(""); }
  }
  useEffect(() => {
    if (!selected) return;
    let active = true;
    fetch("/api/journeys/learning?journeyId=" + encodeURIComponent(selected), { cache: "no-store" })
      .then(async response => { if (!response.ok) throw new Error("Histórico indisponível."); return response.json(); })
      .then(payload => {
        if (!active || !Array.isArray(payload.entries)) return;
        const answers: Record<string, string> = {};
        const feedback: Record<string, string> = {};
        for (const entry of payload.entries) {
          if (typeof entry.mission_id !== "string") continue;
          if (typeof entry.answer === "string") answers[entry.mission_id] = entry.answer;
          if (typeof entry.feedback === "string") feedback[entry.mission_id] = entry.feedback;
        }
        setExerciseAnswers(answers);
        setAiFeedback(feedback);
      }).catch(() => { if (active) setExerciseMessage({}); });
    return () => { active = false; };
  }, [selected]);
  async function saveExercise(mission: Mission, feedback?: string) {
    if (!selected || savingExercise) return;
    setSavingExercise(mission.id);
    try {
      const response = await fetch("/api/journeys/learning", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ journeyId: selected, missionId: mission.id, answer: exerciseAnswers[mission.id] ?? "", ...(feedback !== undefined ? { feedback } : {}) }),
      });
      if (!response.ok) throw new Error("Não foi possível salvar.");
      setExerciseMessage(old => ({ ...old, [mission.id]: "Resposta salva na sua jornada." }));
    } catch { setExerciseMessage(old => ({ ...old, [mission.id]: "Não foi possível salvar. Tente novamente." })); }
    finally { setSavingExercise(null); }
  }
  async function evaluateExercise(mission: Mission) {
    const answer = (exerciseAnswers[mission.id] ?? "").trim();
    if (!selected || answer.length < 30 || feedbackBusy) return;
    const exercise = lessonFor(mission.title)?.exercise;
    if (!exercise) return;
    setFeedbackBusy(mission.id);
    setAiFeedback(old => ({ ...old, [mission.id]: "" }));
    try {
      const response = await fetch("/api/journeys/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ journeyId: selected, missionId: mission.id, answer, exercise }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Não foi possível avaliar.");
      setAiFeedback(old => ({ ...old, [mission.id]: typeof payload.feedback === "string" ? payload.feedback : "Nenhuma avaliação recebida." }));
    } catch (cause) { setAiFeedback(old => ({ ...old, [mission.id]: cause instanceof Error ? cause.message : "Falha na avaliação." })); }
    finally { setFeedbackBusy(null); }
  }
  async function complete(mission: Mission) {
    if (busy) return;
    setBusy(mission.id);
    setError("");
    try {
      // Confirm a new ledger credit instead of assuming that completing a mission earns MYRAs.
      let balanceBefore: number | null = null;
      if (mission.status !== "completed") {
        try {
          const beforeResponse = await fetch("/api/journeys/myra", { cache: "no-store" });
          if (beforeResponse.ok) {
            const before = await beforeResponse.json();
            if (typeof before.balance === "number") balanceBefore = before.balance;
          }
        } catch { /* Mission updates remain available when rewards cannot be verified. */ }
      }
      const r = await fetch("/api/journeys/" + encodeURIComponent(selected) + "/missions/" + encodeURIComponent(mission.id), {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: mission.status === "completed" ? "pending" : "completed" })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Não foi possível atualizar a missão.");
      setMissions(old => old.map(m => m.id === mission.id ? { ...m, status: data.mission.status } : m));
      setEarnedMyra(false);
      if (data.mission.status === "completed") {
        setCelebratedMission(mission.id);
        try {
          const afterResponse = await fetch("/api/journeys/myra", { cache: "no-store" });
          if (afterResponse.ok) {
            const after = await afterResponse.json();
            if (typeof after.balance === "number") {
              setMyraBalance(after.balance);
              if (Array.isArray(after.recent)) setMyraHistory(after.recent);
              if (balanceBefore !== null && after.balance === balanceBefore + 10 &&
                Array.isArray(after.recent) && after.recent.some((entry: MyraEntry) => entry.mission_id === mission.id)) {
                setEarnedMyra(true);
              }
            }
          }
        } catch { /* Never show unverified reward credits. */ }
      } else {
        setCelebratedMission(null);
        void refreshMyra();
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Falha ao atualizar."); }
    finally { setBusy(""); }
  }
  const lessonTopics = [
    { match: /IA, machine learning e IA generativa|diferença entre IA, ML e modelos generativos/i, heading: "Aula MIKA · Fundamentos de IA", explanation: "Inteligência artificial é o campo amplo de sistemas que realizam tarefas associadas à inteligência. Machine learning aprende padrões a partir de dados; IA generativa produz novos conteúdos, como textos e imagens.", example: "Exemplo: um modelo que prevê inadimplência é preditivo; um assistente que redige uma explicação é generativo.", exercise: "Escreva um exemplo de IA preditiva e outro de IA generativa aplicados ao seu trabalho." },
    { match: /treino, validação, teste|vazamento|vieses/i, heading: "Aula MIKA · Qualidade dos dados", explanation: "Dados de treino ajustam o modelo, validação ajuda a escolher parâmetros e teste estima o desempenho em dados não vistos. Vazamento acontece quando informação indisponível no momento real da previsão entra no treinamento.", example: "Exemplo: usar o resultado final de uma contratação para prever se ela será aprovada gera vazamento.", exercise: "Liste três campos que poderiam causar vazamento em um projeto de previsão." },
    { match: /classificação, regressão|métricas de avaliação|métricas adequadas/i, heading: "Aula MIKA · Modelos e métricas", explanation: "Classificação prevê categorias, como fraude ou não fraude. Regressão prevê números, como valor de uma venda. Precisão, recall e F1 ajudam a avaliar classificadores; MAE e RMSE avaliam erros numéricos.", example: "Exemplo: detectar fraude é classificação; estimar o valor de uma transação é regressão.", exercise: "Escolha uma métrica para um sistema de detecção de fraude e justifique." },
    { match: /prompts estruturados|respostas de IA/i, heading: "Aula MIKA · Engenharia de prompts", explanation: "Um bom prompt define papel, contexto, tarefa, restrições e formato de saída. Compare resultados e verifique fatos: modelos podem produzir respostas incorretas com confiança.", example: "Exemplo: 'Resuma este incidente em até 100 palavras, com impacto, causa conhecida e próximos passos; não invente dados'.", exercise: "Reescreva um pedido vago como um prompt com critérios claros e teste duas versões." },
    { match: /embeddings|RAG|busca semântica|fontes verificáveis/i, heading: "Aula MIKA · RAG", explanation: "Embeddings representam significado em vetores. RAG busca trechos relevantes em uma base de conhecimento e os fornece ao modelo para apoiar a resposta. As fontes recuperadas também precisam ser verificadas.", example: "Exemplo: responder perguntas sobre procedimentos internos usando documentos autorizados e citados.", exercise: "Desenhe quatro etapas: pergunta, busca, recuperação de fontes e resposta com referências." },
    { match: /LGPD|uso responsável|privacidade, segurança|riscos e controles/i, heading: "Aula MIKA · IA responsável", explanation: "Projetos de IA devem limitar dados pessoais, definir finalidade, controlar acessos, testar vieses e permitir supervisão humana. Dados sensíveis não devem ser enviados a serviços sem autorização.", example: "Exemplo: anonimizar exemplos de incidentes antes de usá-los em treinamento.", exercise: "Liste três riscos de privacidade e um controle para cada risco." },
    { match: /pequeno projeto aplicado|problema, dados, indicadores|protótipo viável/i, heading: "Aula MIKA · Projeto aplicado", explanation: "Comece com um problema mensurável. Defina indicador de sucesso, dados disponíveis, baseline, avaliação e limites do protótipo antes de escolher um modelo.", example: "Exemplo: priorizar alertas operacionais e medir a redução do tempo de triagem.", exercise: "Escreva problema, métrica, fontes de dados e hipótese de valor em quatro linhas." },
    { match: /apresentar o projeto|demonstração curta/i, heading: "Aula MIKA · Demonstração", explanation: "Uma apresentação convincente mostra o problema, a solução, a evidência, as limitações e os próximos passos. Separe resultados observados de expectativas.", example: "Exemplo: demonstrar três casos de teste e explicar quando o sistema falha.", exercise: "Prepare uma apresentação de três minutos com um resultado verificável e uma limitação." },
  ];
  function lessonFor(title: string) { return lessonTopics.find(topic => topic.match.test(title)); }
  const done = missions.filter(m => m.status === "completed").length;
  const percent = missions.length ? Math.round(done / missions.length * 100) : 0;
  const current = journeys.find(j => j.id === selected);
  const finished = missions.length > 0 && done === missions.length;
  const firstPending = missions.findIndex(m => m.status !== "completed");
  const focusIndex = firstPending === -1 ? Math.max(0, missions.length - 1) : firstPending;
  const windowStart = showAllMissions ? 0 : Math.max(0, focusIndex - 2);
  const windowEnd = showAllMissions ? missions.length : Math.min(missions.length, Math.max(7, focusIndex + 5));
  const visibleMissions = missions.slice(windowStart, windowEnd);
  const chapterSize = 8;
  const goalWords = (current?.title ?? "").normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").toLowerCase();
  const chapterNames = /intercambio|estudar no exterior|estudar fora/.test(goalWords)
    ? ["🎓 Escolher o programa", "📋 Documentos e orçamento", "✈️ Preparar a viagem", "🌍 Começar os estudos"]
    : /viagem|viajar|ferias|turismo|visitar|roteiro|passagens/.test(goalWords)
      ? ["🗺️ Escolher o destino", "💰 Planejar os custos", "🧳 Organizar a viagem", "✈️ Preparar o embarque"]
      : /italian|ingles|espanhol|frances|idioma|lingua/.test(goalWords)
        ? ["📚 Construir a base", "🗣️ Praticar o idioma", "🎧 Ganhar fluência", "🏅 Demonstrar evolução"]
        : /corr|caminh|maraton|quilometr/.test(goalWords)
          ? ["👟 Começar com segurança", "🏃 Criar consistência", "📈 Evoluir o ritmo", "🏅 Celebrar a distância"]
          : /economiz|poup|junt|guardar dinheiro|reserva financeira/.test(goalWords)
            ? ["💰 Organizar as contas", "📊 Planejar os aportes", "🌱 Construir a reserva", "🎯 Revisar o objetivo"]
            : ["🌱 Descoberta", "🧭 Preparação", "🚀 Em movimento", "✨ Rumo à conquista"];
  const chapterCount = Math.ceil(missions.length / chapterSize);
  const chapterFor = (index: number) => Math.floor(index / chapterSize);
  const chapterName = (chapter: number) => chapterNames[Math.min(3, Math.floor(chapter * 4 / Math.max(1, chapterCount)))];
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
        <select className="mt-2 w-full rounded-xl border border-violet-400/30 bg-slate-900 p-3 text-white" value={selected} onChange={e => { setSelected(e.target.value); setReplan(null); setEditing(false); setShowAllMissions(false); }}>
          {journeys.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
        </select></label>}
      {current && <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
        <p className="text-xs uppercase tracking-widest text-violet-300">Destino escolhido</p>
        <h3 className="mt-1 text-2xl font-bold">✧ {current.title}</h3>
        <p className="mt-1 text-sm text-slate-300">{current.target_date ? "Meta: " + current.target_date : "Uma conquista de cada vez"}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={!!busy} onClick={() => { setGoalTitle(current.title); setGoalDate(current.target_date ?? ""); setEditing(v => !v); }} className="rounded-lg border border-violet-300/40 px-3 py-2 text-xs font-semibold text-violet-100">✎ Editar meta</button>
          <button type="button" disabled={!!busy} onClick={() => void changeGoal(true)} className="rounded-lg border border-rose-300/40 px-3 py-2 text-xs font-semibold text-rose-200">Excluir meta</button>
        </div>
        {editing && <div className="mt-3 space-y-3 rounded-xl border border-violet-300/20 bg-slate-950/70 p-3">
          <label className="block text-xs text-slate-200">Nome da meta<input value={goalTitle} maxLength={120} onChange={e => setGoalTitle(e.target.value)} className="mt-1 w-full rounded-lg border border-white/20 bg-slate-900 p-2 text-sm text-white" /></label>
          <label className="block text-xs text-slate-200">Data-alvo (opcional)<input type="date" value={goalDate} onChange={e => setGoalDate(e.target.value)} className="mt-1 w-full rounded-lg border border-white/20 bg-slate-900 p-2 text-sm text-white" /></label>
          <p className="text-xs text-slate-400">Alterar o nome ou a data não modifica as missões existentes. Para isso, use o replanejamento.</p>
          <div className="flex gap-2"><button type="button" disabled={!!busy || !goalTitle.trim()} onClick={() => void changeGoal(false)} className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Salvar alterações</button><button type="button" onClick={() => setEditing(false)} className="rounded-lg border border-white/20 px-3 py-2 text-xs text-white">Cancelar</button></div>
        </div>}
        <div className="mt-4 flex items-center justify-between text-sm"><span>{done} de {missions.length} missões</span><strong>{percent}%</strong></div>
        <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-700" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Progresso da jornada"><div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-400 transition-all duration-500" style={{ width: percent + "%" }} /></div>
      </div>}
      {current && missions.length > 0 && <div className="mt-4 rounded-2xl border border-violet-400/30 bg-slate-900/70 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-sm font-bold text-violet-100">✨ Replanejar com a MIKA</p><p className="mt-1 text-xs text-slate-300">Veja uma proposta mais objetiva sem alterar seu progresso.</p></div>
          <button type="button" disabled={!!busy} onClick={() => void previewReplan()} className="rounded-xl border border-violet-300/40 bg-violet-700/50 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy === "replan" ? "Preparando..." : "Visualizar novo caminho"}</button>
        </div>
        {replan && <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
          <p className="text-sm font-semibold text-emerald-200">🔒 Prévia segura: {replan.preserved.completed.length} conquista(s) preservada(s). Nenhuma MYRA foi alterada.</p>
          <p className="text-xs text-slate-300">Jornada atual: {replan.preserved.existingMissionCount} missões · Proposta: {replan.proposed.length} missões. Esta visualização não substitui a jornada existente.</p>
          {replan.planning?.deadlineNeedsReview && <p role="alert" className="rounded-lg border border-amber-400/40 bg-amber-400/10 p-3 text-xs text-amber-100">⚠ O prazo original já passou. Esta prévia foi criada sem data-alvo. Edite a data da meta antes de decidir sobre um novo planejamento.</p>}
          {replan.planning?.targetDate && <p className="text-xs text-violet-200">Prazo considerado: {replan.planning.targetDate} · Missões ainda não concluídas: {replan.planning.remainingMissions}</p>}
          <ol className="max-h-72 space-y-2 overflow-y-auto pr-1">{replan.proposed.map((m, i) => <li key={i} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100"><span className="mr-2 text-violet-300">{i + 1}.</span>{m.title}</li>)}</ol>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={!!busy || !replan.revision || !!replan.planning?.deadlineNeedsReview || replan.proposed.length === 0} onClick={() => void applyReplan()} className="rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{busy === "apply-replan" ? "Confirmando..." : "Confirmar novo caminho"}</button>
            <button type="button" disabled={!!busy} onClick={() => setReplan(null)} className="rounded-lg border border-white/20 px-3 py-2 text-xs text-slate-200">Fechar prévia</button>
          </div>
          <p className="text-xs text-slate-400">A confirmação preserva conquistas, MYRAs e missões vinculadas. Missões pendentes sem vínculos poderão ser substituídas.</p>
        </div>}
      </div>}
      {celebratedMission && !finished && <div role="status" className="mt-5 rounded-2xl border border-amber-300/50 bg-gradient-to-r from-violet-900/90 to-fuchsia-900/80 p-4 text-center shadow-[0_0_35px_rgba(232,121,249,0.2)]"><div aria-hidden="true" className="relative mx-auto flex h-20 w-28 items-center justify-center"><span className="absolute left-0 top-2 text-2xl motion-safe:animate-bounce">✨</span><span className="text-5xl motion-safe:animate-bounce">🪙</span><span className="absolute right-0 top-0 text-2xl motion-safe:animate-pulse">⭐</span><span className="absolute bottom-0 right-3 text-xl motion-safe:animate-bounce">✨</span></div><p className="mt-2 text-lg font-bold text-amber-200">Missão conquistada!</p>{earnedMyra && <p className="mt-2 text-2xl font-black text-amber-300 motion-safe:animate-pulse">+10 MYRAs 🪙</p>}<p className="mt-1 text-sm text-violet-100">A MIKA está celebrando seu progresso. Continue avançando pelo mapa!</p><button type="button" onClick={() => setCelebratedMission(null)} className="mt-3 rounded-xl border border-white/30 px-4 py-2 text-xs font-semibold text-white">Continuar minha aventura</button></div>}
      {current && finished && !loading && (
        <div role="status" aria-label="Jornada concluída" className="relative mt-6 overflow-hidden rounded-3xl border border-amber-300/50 bg-gradient-to-br from-amber-500/25 via-fuchsia-700/25 to-violet-900/80 p-6 text-center shadow-[0_0_60px_rgba(217,70,239,0.18)] sm:p-9">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-50" style={{ backgroundImage: "radial-gradient(circle at 20% 20%, #fbbf24 1px, transparent 2px), radial-gradient(circle at 80% 60%, #e879f9 1px, transparent 2px)", backgroundSize: "37px 43px, 53px 61px" }} />
          <div className="relative">
            <div className="text-5xl motion-safe:animate-bounce" aria-hidden="true">🏆</div>
            <p className="mt-3 text-xs font-bold uppercase tracking-[0.25em] text-amber-200">Destino alcançado</p>
            <h3 className="mt-2 text-3xl font-extrabold text-white sm:text-4xl">Você conseguiu!</h3>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-violet-100">Sua jornada <strong>{current.title}</strong> chegou ao destino. Foram <strong>{done} missões concluídas</strong>. Cada passo fez parte dessa conquista.</p>
            <p className="mt-3 text-sm font-medium text-amber-200">✦ MIKA: que conquista incrível! Celebre este momento. Seu próximo sonho já pode começar.</p>
            <JourneyAchievementCard key={current.id} journeyId={current.id} title={current.title} completedCount={done} />
            <div className="mt-6 flex flex-wrap justify-center gap-3">
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
            <p className="mt-2 text-xs text-violet-200">Seu próximo passo em destaque. Avance no seu ritmo.</p>
            {missions.length > 7 && <p className="mt-2 text-xs text-amber-200">🧭 Mostrando etapas {windowStart + 1}–{windowEnd} de {missions.length}</p>}
          </div>
          <div className="relative">
            <svg aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
              <path d="M 50 0 C 50 8, 16 8, 16 17 S 84 27, 84 35 S 16 45, 16 53 S 84 63, 84 71 S 16 81, 16 89 S 50 97, 50 100" fill="none" stroke="#a78bfa" strokeWidth="1.8" strokeDasharray="2 2" opacity=".65" vectorEffect="non-scaling-stroke" />
              <path d="M 50 0 C 50 8, 16 8, 16 17 S 84 27, 84 35 S 16 45, 16 53 S 84 63, 84 71 S 16 81, 16 89 S 50 97, 50 100" fill="none" stroke="#e879f9" strokeWidth=".6" opacity=".4" vectorEffect="non-scaling-stroke" />
            </svg>
            <ol className="relative space-y-5">
              {visibleMissions.map((m, localIndex) => {
                const i = windowStart + localIndex;
                const completed = m.status === "completed";
                const next = !completed && missions.slice(0, i).every(x => x.status === "completed");
                return <li key={m.id} className="space-y-4">
                  {(localIndex === 0 || chapterFor(i) !== chapterFor(i - 1)) && <div className="mx-auto w-fit rounded-2xl border border-fuchsia-300/35 bg-indigo-950/95 px-4 py-3 text-center shadow-lg">
                    <p className="text-xs font-bold uppercase tracking-wider text-fuchsia-200">Capítulo {chapterFor(i) + 1} de {chapterCount}</p>
                    <p className="mt-1 text-sm font-semibold text-white">{chapterName(chapterFor(i))}</p>
                    <p className="mt-1 text-xs text-violet-200">{missions.slice(chapterFor(i) * chapterSize, Math.min(missions.length, (chapterFor(i) + 1) * chapterSize)).filter(item => item.status === "completed").length} conquistas realizadas neste capítulo</p>
                  </div>}
                  <div className={"flex " + (i % 2 ? "justify-end" : "justify-start")}>
                  <button type="button" disabled={!!busy} onClick={() => void complete(m)}
                    aria-label={(completed ? "Reabrir missão: " : "Concluir missão: ") + m.title}
                    className={"group relative w-[78%] min-w-0 rounded-2xl border p-4 text-left shadow-xl backdrop-blur-md transition-all duration-300 hover:-translate-y-1 active:scale-[.98] disabled:opacity-60 sm:w-[69%] " +
                      (completed ? "border-emerald-300/60 bg-emerald-950/90 shadow-emerald-900/20" : next ? "border-amber-300/80 bg-violet-800/95 shadow-fuchsia-600/20 ring-2 ring-fuchsia-400/25" : "border-violet-300/25 bg-slate-900/95")}>
                    <span aria-hidden="true" className={"absolute -top-3 " + (i % 2 ? "-right-2" : "-left-2") + " flex h-9 w-9 items-center justify-center rounded-full border-2 border-violet-200/70 bg-violet-800 text-lg shadow-lg"}>{completed ? "⭐" : next ? "🚀" : "🔮"}</span>
                    <span className="block text-[10px] font-bold uppercase tracking-[.18em] text-violet-200">Etapa {i + 1} · {m.week ? "Semana " + m.week : "Sua missão"}</span>
                    <span className="mt-2 block break-words text-sm font-semibold leading-relaxed text-white sm:text-base">{m.title}</span>
                    <span className={"mt-3 inline-flex rounded-full px-3 py-1 text-[11px] font-bold " + (completed ? "bg-emerald-400/20 text-emerald-200" : next ? "bg-amber-300/20 text-amber-200" : "bg-white/10 text-violet-200")}>{completed ? "✓ Conquista realizada" : next ? "✦ Sua próxima missão" : "◇ Aguardando sua vez"}</span>
                  </button>
                  </div>
                  {lessonFor(m.title) && <div className="mx-auto w-[92%] rounded-xl border border-violet-300/25 bg-slate-900/80 p-3 sm:w-[85%]">
                    <button type="button" onClick={() => setOpenLesson(value => value === m.id ? null : m.id)} aria-expanded={openLesson === m.id} className="w-full text-left text-xs font-semibold text-amber-200">{openLesson === m.id ? "▾ Fechar treinamento" : "▸ Estudar com a MIKA · Aula e exercício"}</button>
                    {openLesson === m.id && (() => { const lesson = lessonFor(m.title)!; return <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-200"><p className="font-bold text-white">{lesson.heading}</p><p>{lesson.explanation}</p><p className="rounded-lg bg-violet-800/25 p-3">{lesson.example}</p><p className="font-semibold text-amber-100">Sua prática: {lesson.exercise}</p>
                    <label className="block space-y-2"><span className="block text-xs font-semibold text-violet-100">Sua resposta (rascunho local)</span><textarea value={exerciseAnswers[m.id] ?? ""} onChange={event => { setExerciseAnswers(old => ({ ...old, [m.id]: event.target.value.slice(0, 2000) })); setShowReview(null); setAiFeedback(oldFeedback => ({ ...oldFeedback, [m.id]: "" })); }} rows={4} maxLength={2000} placeholder="Registre seu raciocínio e os exemplos aqui..." className="w-full rounded-lg border border-violet-300/30 bg-slate-950 p-3 text-sm text-white placeholder:text-slate-400" /></label>
                    <button type="button" disabled={savingExercise === m.id} onClick={() => void saveExercise(m, aiFeedback[m.id] ?? "")} className="rounded-lg border border-violet-300/40 px-3 py-2 text-xs font-semibold text-violet-100 disabled:opacity-40">{savingExercise === m.id ? "Salvando..." : "Salvar resposta"}</button>
                    {exerciseMessage[m.id] && <p role="status" className="text-xs text-violet-100">{exerciseMessage[m.id]}</p>}
                    <button type="button" disabled={(exerciseAnswers[m.id] ?? "").trim().length < 30 || !!feedbackBusy} onClick={() => void evaluateExercise(m)} className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">{feedbackBusy === m.id ? "MIKA está avaliando..." : "Avaliar com a MIKA"}</button>
                    {aiFeedback[m.id] && <div role="status" className="whitespace-pre-wrap rounded-lg border border-violet-300/30 bg-violet-800/20 p-3 text-xs leading-relaxed text-white">{aiFeedback[m.id]}</div>}
                    <button type="button" disabled={(exerciseAnswers[m.id] ?? "").trim().length < 30} onClick={() => setShowReview(m.id)} className="rounded-lg border border-amber-300/40 bg-amber-300/10 px-3 py-2 text-xs font-semibold text-amber-100 disabled:opacity-40">Revisar minha resposta</button>
                    {showReview === m.id && <div role="status" className="space-y-2 rounded-lg border border-violet-300/30 bg-violet-900/20 p-3 text-xs"><p className="font-bold text-white">Checklist para autoavaliação</p><p>✓ Você respondeu ao que foi pedido no exercício?</p><p>✓ Incluiu um exemplo concreto e explicou seu raciocínio?</p><p>✓ Consegue identificar uma limitação ou algo que ainda precisa pesquisar?</p><p className="text-amber-200">Esta revisão é orientativa, não uma correção por IA. A resposta não foi enviada nem salva no servidor. Só marque a missão concluída depois de realizar a prática.</p></div>}<p className="text-xs text-slate-400">Este conteúdo é introdutório. Realize o exercício antes de marcar a missão como concluída.</p></div>; })()}
                  </div>}
                </li>;
              })}
            </ol>
            {missions.length > 7 && <div className="relative mt-6 flex flex-wrap justify-center gap-3">
              <button type="button" onClick={() => setShowAllMissions(value => !value)} className="rounded-xl border border-violet-300/40 bg-violet-700/40 px-4 py-3 text-sm font-semibold text-white">{showAllMissions ? "✨ Voltar ao meu próximo passo" : "🗺️ Explorar todas as " + missions.length + " etapas"}</button>
            </div>}
          </div>
          <div className="relative mx-auto mt-8 w-fit rounded-2xl border border-amber-300/50 bg-amber-300/15 px-6 py-4 text-center shadow-[0_0_35px_rgba(251,191,36,0.12)]">
            <span className="block text-3xl" aria-hidden="true">{finished ? "🏆" : "🏰"}</span>
            <span className="mt-1 block text-sm font-bold text-amber-100">{finished ? "Destino conquistado!" : "O destino dos seus sonhos"}</span>
          </div>
        </div>}
      <details className="mt-5 rounded-2xl border border-amber-300/25 bg-amber-300/5 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-amber-200">🪙 Meu tesouro MYRA · Histórico de conquistas</summary>
        <p className="mt-2 text-xs text-violet-200">Cada missão pode render 10 MYRAs apenas uma vez. Moedas virtuais, sem valor monetário.</p>
        {myraBalance === null ? <p className="mt-3 text-sm text-slate-300">Carregando recompensas...</p> : myraHistory.length === 0 ?
          <p className="mt-3 text-sm text-slate-300">Seu primeiro tesouro aparece quando você concluir uma missão.</p> :
          <ol className="mt-3 space-y-2">
            {myraHistory.map(entry => <li key={entry.mission_id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-violet-100">
              <span><span aria-hidden="true">⭐ </span>Missão conquistada <span className="block text-[11px] text-slate-400">{new Date(entry.created_at).toLocaleDateString("pt-BR")}</span></span>
              <strong className="whitespace-nowrap text-amber-200">+{entry.amount} MYRA</strong>
            </li>)}
          </ol>}
        {myraHistory.length === 10 && <p className="mt-2 text-xs text-slate-400">Exibindo as 10 conquistas mais recentes.</p>}
      </details>
      {error && <p role="alert" className="mt-4 text-sm text-rose-300">{error}</p>}
      <p className="mt-5 text-center text-xs text-slate-400">Cada missão concluída vale 10 MYRAs virtuais, uma única vez. As moedas não possuem valor monetário.</p>
    </section>
  );
}
