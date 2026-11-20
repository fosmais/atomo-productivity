"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type SuggestedTask = { title: string; priority: "Alta" | "Média" | "Normal"; dueDate: string | null };

type Idea = {
  id: string;
  content: string;
  title: string | null;
  status: "captured" | "analyzing" | "planned" | "archived";
  created_at: string;
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

  const load = useCallback(async () => {
    const client = createClient();
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) throw new Error("Faça login para acessar suas ideias.");
    const { data, error: queryError } = await client
      .from("mika_ideas")
      .select("id,content,title,status,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);
    if (queryError) throw queryError;
    setIdeas((data ?? []) as Idea[]);
    return user.id;
  }, []);

  useEffect(() => {
    let active = true;
    load().catch((e: unknown) => {
      if (active) setError(e instanceof Error ? e.message : "Erro ao carregar ideias.");
    });
    return () => { active = false; };
  }, [load]);

  async function save() {
    const content = draft.trim();
    if (!content || content.length > 10000 || busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const client = createClient();
      const { data: { user }, error: authError } = await client.auth.getUser();
      if (authError || !user) throw new Error("Sessão expirada. Faça login novamente.");
      const { error: insertError } = await client.from("mika_ideas")
        .insert({ user_id: user.id, content, source: "text" });
      if (insertError) throw insertError;
      setDraft("");
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
      const { error: updateError } = await client.from("mika_ideas")
        .update({ status: archived ? "archived" : "captured", updated_at: new Date().toISOString() })
        .eq("id", id).eq("user_id", user.id);
      if (updateError) throw updateError;
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
      const response = await fetch("/api/tasks", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: idea.content }),
      });
      const result: unknown = await response.json();
      if (!response.ok) throw new Error("Não foi possível gerar a sugestão.");
      if (!result || typeof result !== "object" || !("tasks" in result) || !Array.isArray(result.tasks))
        throw new Error("Resposta inesperada da MIKA.");
      const tasks = result.tasks.filter((task: unknown): task is SuggestedTask => {
        if (!task || typeof task !== "object") return false;
        const t = task as Record<string, unknown>;
        return typeof t.title === "string" && t.title.trim().length > 0 &&
          (t.priority === "Alta" || t.priority === "Média" || t.priority === "Normal") &&
          (t.dueDate === null || typeof t.dueDate === "string");
      }).slice(0, 10);
      if (!tasks.length) throw new Error("Nenhuma ação foi sugerida.");
      setSuggestions((previous) => ({ ...previous, [idea.id]: tasks }));
      setNotice("Sugestão gerada. Nenhuma tarefa foi criada.");
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Falha ao gerar sugestão."); }
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
      const { error: updateError } = await client.from("mika_ideas")
        .update({ content, updated_at: new Date().toISOString() })
        .eq("id", id).eq("user_id", user.id);
      if (updateError) throw updateError;
      setEditingId(null); await load(); setNotice("Ideia atualizada.");
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
      const { error: deleteError } = await client.from("mika_ideas")
        .delete().eq("id", id).eq("user_id", user.id);
      if (deleteError) throw deleteError;
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
        <h1 className="text-2xl font-semibold">MIKA Insights</h1>
        <p className="text-sm opacity-70">Capture uma ideia agora. Decida o próximo passo depois.</p>
      </header>
      <section className="space-y-3 rounded-2xl border p-4" aria-label="Nova ideia">
        <label htmlFor="idea-content" className="block font-medium">O que veio à sua mente?</label>
        <textarea id="idea-content" value={draft} maxLength={10000} rows={4}
          onChange={(event) => setDraft(event.target.value)}
          className="w-full rounded-xl border bg-transparent p-3"
          placeholder="Escreva sua ideia..." />
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs opacity-60">Data e hora serão registradas ao salvar.</span>
          <button type="button" disabled={busy || !draft.trim()} onClick={save}
            className="rounded-xl bg-violet-700 px-4 py-2 text-white disabled:opacity-50">
            {busy ? "Salvando..." : "Guardar ideia"}
          </button>
        </div>
      </section>
      {error && <p role="alert" className="text-red-600">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      <section className="space-y-3" aria-label="Minhas ideias">
        <div className="flex items-center justify-between gap-2"><h2 className="text-lg font-semibold">Minhas ideias</h2><button type="button" onClick={() => setShowArchived(!showArchived)} className="rounded-lg border px-3 py-1 text-sm">{showArchived ? "Ver ativas" : "Ver arquivadas"}</button></div>
        <input aria-label="Pesquisar ideias" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Pesquisar..." className="w-full rounded-xl border bg-transparent p-3" />
        {visible.length === 0 && <p className="text-sm opacity-70">Nenhuma ideia encontrada.</p>}
        {visible.map((idea) => (
          <article key={idea.id} className="space-y-2 rounded-2xl border p-4">
            <time className="text-xs opacity-60" dateTime={idea.created_at}>
              {new Date(idea.created_at).toLocaleString("pt-BR")}
            </time>
            {editingId === idea.id ? (
              <div className="space-y-2"><textarea aria-label="Editar ideia" maxLength={10000} rows={4} value={editContent} onChange={(e) => setEditContent(e.target.value)} className="w-full rounded-xl border bg-transparent p-3" /><div className="flex gap-2"><button type="button" disabled={busy || !editContent.trim()} onClick={() => updateIdea(idea.id)} className="rounded-lg border px-3 py-1 text-sm">Salvar</button><button type="button" disabled={busy} onClick={() => setEditingId(null)} className="rounded-lg border px-3 py-1 text-sm">Cancelar</button></div></div>
            ) : <p className="whitespace-pre-wrap break-words">{idea.content}</p>}
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={busy} onClick={() => suggestPlan(idea)} className="rounded-lg border border-violet-500 px-3 py-1 text-sm disabled:opacity-50">MIKA: sugerir plano</button>
              <button type="button" disabled={busy} onClick={() => { setEditingId(idea.id); setEditContent(idea.content); }} className="rounded-lg border px-3 py-1 text-sm disabled:opacity-50">Editar</button>
              {!showArchived && <button type="button" disabled={busy} onClick={() => setArchived(idea.id, true)} className="rounded-lg border px-3 py-1 text-sm disabled:opacity-50">Arquivar</button>}
              {showArchived && <button type="button" disabled={busy} onClick={() => setArchived(idea.id, false)} className="rounded-lg border px-3 py-1 text-sm disabled:opacity-50">Restaurar</button>}
              <button type="button" disabled={busy} onClick={() => removeIdea(idea.id)} className="rounded-lg border px-3 py-1 text-sm text-red-600 disabled:opacity-50">Excluir</button>
            </div>
            {suggestions[idea.id] && <section aria-label="Plano sugerido pela MIKA" className="space-y-2 rounded-xl border p-3"><h3 className="font-medium">Plano sugerido — apenas para revisão</h3><p className="text-xs opacity-70">Nenhuma tarefa foi criada ou agendada. Revise antes de executar.</p><ol className="list-decimal space-y-1 pl-5">{suggestions[idea.id].map((task, index) => <li key={index} className="text-sm">{task.title} — {task.priority}{task.dueDate ? ` · ${task.dueDate}` : ""}</li>)}</ol><button type="button" onClick={() => setSuggestions((previous) => { const next = { ...previous }; delete next[idea.id]; return next; })} className="rounded-lg border px-3 py-1 text-sm">Descartar sugestão</button></section>}
          </article>
        ))}
      </section>
    </main>
  );
}
