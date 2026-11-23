"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

type SuggestedTask = { title: string; priority: "Alta" | "Média" | "Normal"; dueDate: string | null };

type Idea = {
  id: string;
  content: string;
  title: string | null;
  status: "captured" | "analyzing" | "planned" | "archived";
  created_at: string;
  updated_at: string;
  proposed_plan: { tasks: SuggestedTask[] } | null;
};

export default function MikaInsightsPage() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [suggestions, setSuggestions] = useState<Record<string, SuggestedTask[]>>({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [voiceDraft, setVoiceDraft] = useState(false);

  useEffect(() => () => {
    if (recordingTimerRef.current) clearTimeout(recordingTimerRef.current);
    const recorder = recorderRef.current;
    if (recorder) {
      recorder.onstop = null;
      if (recorder.state === "recording") recorder.stop();
      recorder.stream.getTracks().forEach((track) => track.stop());
    }
  }, []);

  const load = useCallback(async () => {
    const client = createClient();
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) throw new Error("Faça login para acessar suas ideias.");
    const { data, error: queryError } = await client
      .from("mika_ideas")
      .select("id,content,title,status,created_at,updated_at,proposed_plan")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);
    if (queryError) throw queryError;
    setIdeas((data ?? []) as Idea[]);
    return user.id;
  }, []);

  useEffect(() => {
    let active = true;
    // Defer the initial async fetch so the effect does not synchronously trigger state updates.
    void Promise.resolve().then(() => {
      if (active) return load();
    }).catch((e: unknown) => {
      if (active) setError(e instanceof Error ? e.message : "Erro ao carregar ideias.");
    });
    return () => { active = false; };
  }, [load]);

  async function startRecording() {
    setError(""); setNotice("");
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Gravação não disponível neste navegador. Você pode digitar sua ideia."); return;
    }
    let stream: MediaStream | null = null;
    try {
      const acquiredStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream = acquiredStream;
      const preferred = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = preferred ? new MediaRecorder(stream, { mimeType: preferred }) : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data); };
      recorder.onstop = async () => {
        if (recordingTimerRef.current) clearTimeout(recordingTimerRef.current);
        setRecording(false);
        acquiredStream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (!blob.size) { setError("Nenhum áudio foi capturado."); return; }
        if (blob.size > 10 * 1024 * 1024) { setError("Áudio acima de 10 MB. Grave uma ideia mais curta."); return; }
        const form = new FormData();
        const extension = blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : "webm";
        form.append("audio", blob, `idea.${extension}`);
        setTranscribing(true); setError("");
        try {
          const response = await fetch("/api/mika-insights/transcribe", { method: "POST", body: form });
          const result: unknown = await response.json();
          if (!response.ok) throw new Error(result && typeof result === "object" && "error" in result && typeof result.error === "string" ? result.error : "Não foi possível transcrever.");
          if (!result || typeof result !== "object" || !("text" in result) || typeof result.text !== "string") throw new Error("Resposta de transcrição inválida.");
          const transcript = result.text;
          // Use the latest draft: the recorder callback can outlive the render that started recording.
          setDraft((current) => {
            const existing = current.trim();
            const combined = [existing, transcript].filter(Boolean).join(existing ? "\n" : "");
            if (combined.length > 10000) {
              setError("Transcrição muito longa. Reduza o texto para até 10.000 caracteres.");
              return current;
            }
            setVoiceDraft(true);
            setNotice("Áudio transcrito. Revise o texto antes de salvar.");
            return combined;
          });
        } catch (e: unknown) { setError(e instanceof Error ? e.message : "Falha na transcrição."); }
        finally { setTranscribing(false); }
      };
      recorderRef.current = recorder; recorder.start(); setRecording(true);
      recordingTimerRef.current = setTimeout(() => {
        if (recorder.state === "recording") recorder.stop();
      }, 60000);
    } catch {
      stream?.getTracks().forEach((track) => track.stop());
      setRecording(false);
      setError("Não foi possível acessar o microfone. Verifique a permissão ou digite sua ideia.");
    }
  }

  function stopRecording() {
    if (recorderRef.current?.state === "recording") {
      if (recordingTimerRef.current) clearTimeout(recordingTimerRef.current);
      recorderRef.current.stop(); setRecording(false);
    }
  }

  async function save() {
    const content = draft.trim();
    if (!content || content.length > 10000 || busy || recording || transcribing) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const client = createClient();
      const { data: { user }, error: authError } = await client.auth.getUser();
      if (authError || !user) throw new Error("Sessão expirada. Faça login novamente.");
      const { error: insertError } = await client.from("mika_ideas")
        .insert({ user_id: user.id, content, source: voiceDraft ? "voice" : "text" });
      if (insertError) throw insertError;
      setDraft(""); setVoiceDraft(false);
      await load();
      setNotice("Ideia registrada com sucesso.");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally { setBusy(false); }
  }

  async function setArchived(id: string, archived: boolean) {
    setBusy(true); setError(""); setNotice("");
    try {
      const client = createClient();
      const { data: { user }, error: authError } = await client.auth.getUser();
      if (authError || !user) throw new Error("Sessão expirada.");
      const idea = ideas.find((item) => item.id === id);
      if (!idea) throw new Error("Ideia não encontrada. Atualize a página.");
      const restoredStatus = idea.proposed_plan?.tasks?.length ? "planned" : "captured";
      const { data: updated, error: updateError } = await client.from("mika_ideas")
        .update({ status: archived ? "archived" : restoredStatus, updated_at: new Date().toISOString() })
        .eq("id", id).eq("user_id", user.id).eq("updated_at", idea.updated_at)
        .select("id");
      if (updateError) throw updateError;
      if (!updated?.length) throw new Error("A ideia mudou em outra sessão. Atualize a página antes de arquivar ou restaurar.");
      setSuggestions((previous) => { const next = { ...previous }; delete next[id]; return next; });
      await load();
      setNotice(archived ? "Ideia arquivada." : "Ideia restaurada.");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Não foi possível arquivar.");
    } finally { setBusy(false); }
  }

  async function suggestPlan(idea: Idea) {
    if (busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const client = createClient();
      const { data: { user }, error: authError } = await client.auth.getUser();
      if (authError || !user) throw new Error("Faça login para pedir um plano.");
      const response = await fetch("/api/mika-insights/suggest", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ideaId: idea.id }),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        const message = result && typeof result === "object" && "error" in result && typeof result.error === "string"
          ? result.error : "Não foi possível gerar a sugestão.";
        throw new Error(message);
      }
      if (!result || typeof result !== "object" || !("tasks" in result) || !Array.isArray(result.tasks))
        throw new Error("Resposta inesperada da MIKA.");
      const tasks = result.tasks.filter((task: unknown): task is SuggestedTask => {
        if (!task || typeof task !== "object") return false;
        const t = task as Record<string, unknown>;
        return typeof t.title === "string" && t.title.trim().length > 0 &&
          (t.priority === "Alta" || t.priority === "Média" || t.priority === "Normal") &&
          (t.dueDate === null || typeof t.dueDate === "string");
      }).slice(0, 8);
      if (!tasks.length) throw new Error("Nenhuma ação foi sugerida.");
      setSuggestions((previous) => ({ ...previous, [idea.id]: tasks }));
      setNotice("Sugestão gerada. Nenhuma tarefa foi criada.");
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Falha ao gerar sugestão."); }
    finally { setBusy(false); }
  }

  async function saveSuggestedPlan(idea: Idea) {
    const tasks = suggestions[idea.id];
    if (!tasks?.length || busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const client = createClient();
      const { data: { user }, error: authError } = await client.auth.getUser();
      if (authError || !user) throw new Error("Sessão expirada.");
      const { data: updated, error: updateError } = await client.from("mika_ideas")
        .update({ proposed_plan: { tasks }, status: "planned", updated_at: new Date().toISOString() })
        .eq("id", idea.id).eq("user_id", user.id).eq("updated_at", idea.updated_at).neq("status", "archived")
        .select("id");
      if (updateError) throw updateError;
      if (!updated?.length) throw new Error("A ideia foi modificada, arquivada ou removida em outra sessão. Atualize a página e gere uma nova sugestão.");
      setSuggestions((previous) => { const next = { ...previous }; delete next[idea.id]; return next; });
      await load();
      setNotice("Plano salvo na ideia. Nenhuma tarefa foi criada automaticamente.");
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Não foi possível salvar o plano."); }
    finally { setBusy(false); }
  }

  async function updateIdea(id: string) {
    const content = editContent.trim();
    if (!content || content.length > 10000 || busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const client = createClient();
      const { data: { user }, error: authError } = await client.auth.getUser();
      if (authError || !user) throw new Error("Sessão expirada.");
      const currentIdea = ideas.find((item) => item.id === id);
      if (!currentIdea) throw new Error("Ideia não encontrada. Atualize a página.");
      const nextStatus = currentIdea.status === "archived" ? "archived" : "captured";
      const { data: updated, error: updateError } = await client.from("mika_ideas")
        .update({ content, proposed_plan: null, status: nextStatus, updated_at: new Date().toISOString() })
        .eq("id", id).eq("user_id", user.id).eq("updated_at", currentIdea.updated_at)
        .select("id");
      if (updateError) throw updateError;
      if (!updated?.length) throw new Error("A ideia foi modificada ou removida em outra sessão. Atualize a página antes de editar.");
      setSuggestions((previous) => { const next = { ...previous }; delete next[id]; return next; });
      setEditingId(null); await load(); setNotice("Ideia atualizada. Gere novamente o plano se necessário.");
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Falha ao editar."); }
    finally { setBusy(false); }
  }

  async function removeIdea(id: string) {
    if (!window.confirm("Excluir esta ideia permanentemente?")) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const client = createClient();
      const { data: { user }, error: authError } = await client.auth.getUser();
      if (authError || !user) throw new Error("Sessão expirada.");
      const currentIdea = ideas.find((item) => item.id === id);
      if (!currentIdea) throw new Error("Ideia não encontrada. Atualize a página.");
      const { data: deleted, error: deleteError } = await client.from("mika_ideas")
        .delete().eq("id", id).eq("user_id", user.id).eq("updated_at", currentIdea.updated_at).select("id");
      if (deleteError) throw deleteError;
      if (!deleted?.length) throw new Error("A ideia foi alterada ou removida em outra sessão. Atualize a página antes de excluir.");
      setSuggestions((previous) => { const next = { ...previous }; delete next[id]; return next; });
      await load(); setNotice("Ideia excluída.");
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Falha ao excluir."); }
    finally { setBusy(false); }
  }

  const visible = ideas.filter((idea) =>
    (showArchived ? idea.status === "archived" : idea.status !== "archived") &&
    (idea.content + " " + (idea.title ?? "")).toLocaleLowerCase().includes(search.toLocaleLowerCase())
  );

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-4 sm:p-8">
      <header>
        <Link href="/dashboard" className="mb-3 inline-flex min-h-11 items-center text-sm text-violet-300 underline-offset-4 hover:underline">← Voltar à Home</Link>
        <h1 className="text-2xl font-semibold">MIKA Insights</h1>
        <details className="mt-3 rounded-xl border border-violet-400/25 bg-violet-400/5 p-3 text-sm">
          <summary className="cursor-pointer font-semibold text-violet-200">Para que serve e como usar?</summary>
          <p className="mt-2 opacity-80">Guarde ideias por texto ou voz, encontre-as pela busca e peça à MIKA sugestões para transformá-las em um plano. Você pode editar, arquivar, restaurar ou excluir cada ideia.</p>
          <p className="mt-2 opacity-80">As sugestões não criam tarefas automaticamente: revise o plano e escolha o que deseja fazer.</p>
        </details>
        <p className="text-sm opacity-70">Capture uma ideia agora. Decida o próximo passo depois.</p>
      </header>
      <section className="space-y-3 rounded-2xl border border-violet-400/20 bg-[#101b30]/90 p-4 shadow-xl shadow-violet-950/10" aria-label="Nova ideia">
        <label htmlFor="idea-content" className="block font-medium">O que veio à sua mente?</label>
        <textarea id="idea-content" value={draft} maxLength={10000} rows={4} disabled={recording || transcribing}
          onChange={(event) => { const value = event.target.value; setDraft(value); if (!value.trim()) setVoiceDraft(false); }}
          className="w-full rounded-xl border border-violet-400/25 bg-[#081321] p-3 text-slate-100 placeholder:text-slate-500 focus:border-violet-400 focus:outline-none"
          placeholder="Escreva sua ideia..." />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button type="button" disabled={busy || transcribing} onClick={recording ? stopRecording : startRecording} className="rounded-xl border border-violet-400/30 bg-violet-400/10 px-3 py-2 text-sm text-violet-100 hover:bg-violet-400/20 disabled:opacity-50">{recording ? "Parar gravação" : transcribing ? "Transcrevendo..." : "Gravar ideia por voz"}</button>
          <span role="status" aria-live="polite" className="text-xs opacity-70">{recording ? "Microfone ativo. A gravação termina automaticamente após 60 segundos." : transcribing ? "Processando áudio. Aguarde a transcrição." : "Data e hora serão registradas ao salvar."}</span>
          <button type="button" disabled={busy || recording || transcribing || !draft.trim()} onClick={save}
            className="rounded-xl bg-violet-700 px-4 py-2 text-white disabled:opacity-50">
            {busy ? "Salvando..." : "Guardar ideia"}
          </button>
        </div>
        <p className="text-xs opacity-70">Ao gravar, seu áudio será enviado ao serviço de IA para transcrição. Revise o texto antes de salvar. O áudio não é armazenado no histórico de ideias.</p>
      </section>
      {error && <p role="alert" className="text-red-300">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      <section className="space-y-3" aria-label="Minhas ideias">
        <div className="flex items-center justify-between gap-2"><h2 className="text-lg font-semibold">Minhas ideias</h2><button type="button" onClick={() => setShowArchived(!showArchived)} className="rounded-lg border border-violet-400/25 bg-white/5 px-3 py-1 text-sm text-slate-100 hover:bg-violet-400/10">{showArchived ? "Ver ativas" : "Ver arquivadas"}</button></div>
        <input aria-label="Pesquisar ideias" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Pesquisar..." className="w-full rounded-xl border border-violet-400/25 bg-[#081321] p-3 text-slate-100 placeholder:text-slate-500 focus:border-violet-400 focus:outline-none" />
        {visible.length === 0 && <p className="text-sm opacity-70">Nenhuma ideia encontrada.</p>}
        {visible.map((idea) => (
          <article key={idea.id} className="space-y-2 rounded-2xl border border-violet-400/20 bg-[#101b30]/90 p-4">
            <time className="text-xs opacity-60" dateTime={idea.created_at}>
              {new Date(idea.created_at).toLocaleString("pt-BR")}
            </time>
            {editingId === idea.id ? (
              <div className="space-y-2"><textarea aria-label="Editar ideia" maxLength={10000} rows={4} value={editContent} onChange={(e) => setEditContent(e.target.value)} className="w-full rounded-xl border border-violet-400/25 bg-[#081321] p-3 text-slate-100 placeholder:text-slate-500 focus:border-violet-400 focus:outline-none" /><div className="flex gap-2"><button type="button" disabled={busy || !editContent.trim()} onClick={() => updateIdea(idea.id)} className="rounded-lg border border-violet-400/25 bg-white/5 px-3 py-1 text-sm text-slate-100 hover:bg-violet-400/10">Salvar</button><button type="button" disabled={busy} onClick={() => setEditingId(null)} className="rounded-lg border border-violet-400/25 bg-white/5 px-3 py-1 text-sm text-slate-100 hover:bg-violet-400/10">Cancelar</button></div></div>
            ) : <p className="whitespace-pre-wrap break-words">{idea.content}</p>}
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={busy || editingId === idea.id || idea.status === "archived"} onClick={() => suggestPlan(idea)} className="rounded-lg border border-violet-500 px-3 py-1 text-sm disabled:opacity-50">MIKA: sugerir plano</button>
              <button type="button" disabled={busy} onClick={() => { setSuggestions((previous) => { const next = { ...previous }; delete next[idea.id]; return next; }); setEditingId(idea.id); setEditContent(idea.content); }} className="rounded-lg border border-violet-400/25 bg-white/5 px-3 py-1 text-sm text-slate-100 hover:bg-violet-400/10 disabled:opacity-50">Editar</button>
              {!showArchived && <button type="button" disabled={busy} onClick={() => setArchived(idea.id, true)} className="rounded-lg border border-violet-400/25 bg-white/5 px-3 py-1 text-sm text-slate-100 hover:bg-violet-400/10 disabled:opacity-50">Arquivar</button>}
              {showArchived && <button type="button" disabled={busy} onClick={() => setArchived(idea.id, false)} className="rounded-lg border border-violet-400/25 bg-white/5 px-3 py-1 text-sm text-slate-100 hover:bg-violet-400/10 disabled:opacity-50">Restaurar</button>}
              <button type="button" disabled={busy} onClick={() => removeIdea(idea.id)} className="rounded-lg border border-red-400/30 px-3 py-1 text-sm text-red-300 hover:bg-red-400/10 disabled:opacity-50">Excluir</button>
            </div>
            {editingId !== idea.id && idea.proposed_plan?.tasks && !suggestions[idea.id] && (
              <section aria-label="Plano salvo" className="space-y-2 rounded-xl border border-violet-400/20 bg-[#081321]/60 p-3">
                <h3 className="font-medium">Plano salvo</h3>
                <p className="text-xs opacity-70">Salvo apenas nesta ideia. Nenhuma tarefa foi criada ou agendada.</p>
                <ol className="list-decimal space-y-1 pl-5">{idea.proposed_plan.tasks.map((task, index) => <li key={index} className="text-sm">{task.title} — {task.priority}{task.dueDate ? ` · ${task.dueDate}` : ""}</li>)}</ol>
              </section>
            )}
            {editingId !== idea.id && idea.status !== "archived" && suggestions[idea.id] && <section aria-label="Plano sugerido pela MIKA" className="space-y-2 rounded-xl border border-violet-400/20 bg-[#081321]/60 p-3"><h3 className="font-medium">Plano sugerido — apenas para revisão</h3><p className="text-xs opacity-70">Nenhuma tarefa foi criada ou agendada. Revise antes de executar.</p><ol className="list-decimal space-y-1 pl-5">{suggestions[idea.id].map((task, index) => <li key={index} className="text-sm">{task.title} — {task.priority}{task.dueDate ? ` · ${task.dueDate}` : ""}</li>)}</ol><div className="flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={() => saveSuggestedPlan(idea)} className="rounded-lg bg-violet-700 px-3 py-1 text-sm text-white disabled:opacity-50">Salvar plano na ideia</button><button type="button" disabled={busy} onClick={() => setSuggestions((previous) => { const next = { ...previous }; delete next[idea.id]; return next; })} className="rounded-lg border border-violet-400/25 bg-white/5 px-3 py-1 text-sm text-slate-100 hover:bg-violet-400/10">Descartar sugestão</button></div></section>}
          </article>
        ))}
      </section>
    </main>
  );
}
