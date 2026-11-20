"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

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

  async function archive(id: string) {
    setBusy(true); setError(""); setNotice("");
    try {
      const client = createClient();
      const { error: updateError } = await client.from("mika_ideas")
        .update({ status: "archived" }).eq("id", id);
      if (updateError) throw updateError;
      await load();
      setNotice("Ideia arquivada.");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Não foi possível arquivar.");
    } finally { setBusy(false); }
  }

  const visible = ideas.filter((idea) =>
    idea.status !== "archived" &&
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
        <h2 className="text-lg font-semibold">Minhas ideias</h2>
        <input aria-label="Pesquisar ideias" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Pesquisar..." className="w-full rounded-xl border bg-transparent p-3" />
        {visible.length === 0 && <p className="text-sm opacity-70">Nenhuma ideia encontrada.</p>}
        {visible.map((idea) => (
          <article key={idea.id} className="space-y-2 rounded-2xl border p-4">
            <time className="text-xs opacity-60" dateTime={idea.created_at}>
              {new Date(idea.created_at).toLocaleString("pt-BR")}
            </time>
            <p className="whitespace-pre-wrap break-words">{idea.content}</p>
            <button type="button" disabled={busy} onClick={() => archive(idea.id)}
              className="rounded-lg border px-3 py-1 text-sm disabled:opacity-50">Arquivar</button>
          </article>
        ))}
      </section>
    </main>
  );
}
