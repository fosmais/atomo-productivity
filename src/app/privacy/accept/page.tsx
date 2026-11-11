"use client";

import { useEffect, useState } from "react";

type LegalDocument = {
  type: "terms" | "privacy_notice";
  version: string | null;
  documentVersionId: string | null;
  publicUrl: string | null;
  published: boolean;
  accepted: boolean;
};
type Readiness = { ready: boolean; documents: LegalDocument[] };

const labels = { terms: "Termos de Uso", privacy_notice: "Aviso de Privacidade" };

export default function PrivacyAcceptancePage() {
  const [state, setState] = useState<Readiness | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function refresh() {
    const response = await fetch("/api/privacy/readiness", { cache: "no-store" });
    if (!response.ok) throw new Error(response.status === 401 ? "Entre na sua conta para continuar." : "Não foi possível consultar os documentos.");
    const data = (await response.json()) as Readiness;
    setState(data);
    setSelected({});
    return data;
  }

  useEffect(() => {
    let active = true;
    void fetch("/api/privacy/readiness", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(response.status === 401 ? "Entre na sua conta para continuar." : "Consulta indisponível.");
        return response.json() as Promise<Readiness>;
      })
      .then((data) => { if (active) setState(data); })
      .catch((err) => { if (active) setError(err instanceof Error ? err.message : "Consulta indisponível."); });
    return () => { active = false; };
  }, []);

  async function accept() {
    if (!state || busy || state.ready) return;
    const pending = state.documents.filter((document) => !document.accepted);
    if (!pending.length || pending.some((document) => !document.published || !document.documentVersionId || !document.publicUrl || !selected[document.type])) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      for (const document of pending) {
        const response = await fetch("/api/privacy/accept", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            documentVersionId: document.documentVersionId,
            requestId: crypto.randomUUID(),
            evidenceSource: "settings",
            accepted: true,
          }),
        });
        if (!response.ok) {
          const result = await response.json().catch(() => ({}));
          throw new Error(typeof result.error === "string" ? result.error : "Não foi possível registrar o aceite.");
        }
      }
      const latest = await refresh();
      if (latest.ready) setNotice("Aceites registrados. Você pode continuar usando sua conta.");
      else setNotice("Registro atualizado. Confira os documentos pendentes.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível concluir.");
      // A partial acceptance may have succeeded; reload to show the authoritative state.
      try { await refresh(); } catch { /* Keep the error visible. */ }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl space-y-5 px-4 py-10 text-slate-100">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Privacidade e Termos</h1>
        <p className="text-sm text-slate-300">Leia cada documento vigente e confirme sua ciência e aceite. Nenhuma opção é marcada automaticamente.</p>
      </header>
      {!state && !error && <p role="status">Consultando documentos...</p>}
      {state?.documents.map((document) => (
        <section key={document.type} className="rounded-2xl border border-slate-700 bg-slate-900 p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold">{labels[document.type]}</h2>
            <span className="text-xs text-slate-300">{document.accepted ? "Aceito" : document.published ? "Pendente" : "Indisponível"}</span>
          </div>
          <p className="mt-1 text-xs text-slate-400">Versão: {document.version ?? "não publicada"}</p>
          {document.publicUrl && /^https:\/\//i.test(document.publicUrl) && (
            <a href={document.publicUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm text-violet-300 underline">
              Ler documento completo
            </a>
          )}
          {!document.accepted && document.published && document.publicUrl && /^https:\/\//i.test(document.publicUrl) && (
            <label className="mt-4 flex items-start gap-3 text-sm">
              <input type="checkbox" className="mt-1" checked={Boolean(selected[document.type])} disabled={busy}
                onChange={(event) => setSelected((previous) => ({ ...previous, [document.type]: event.target.checked }))} />
              <span>Li e aceito a versão {document.version} de {labels[document.type]}.</span>
            </label>
          )}
        </section>
      ))}
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      {notice && <p role="status" className="text-sm text-emerald-300">{notice}</p>}
      {state?.ready ? (
        <a href="/dashboard" className="inline-flex rounded-xl bg-violet-600 px-5 py-3 font-semibold">Ir para o painel</a>
      ) : (
        <button type="button" disabled={busy || !state || state.documents.some((document) =>
          !document.published || !document.publicUrl || !/^https:\/\//i.test(document.publicUrl) || (!document.accepted && !selected[document.type])
        )} onClick={() => void accept()}
          className="rounded-xl bg-violet-600 px-5 py-3 font-semibold disabled:cursor-not-allowed disabled:opacity-40">
          {busy ? "Registrando..." : "Confirmar aceites"}
        </button>
      )}
      <p className="text-xs text-slate-400">Permissões opcionais da MIKA serão solicitadas separadamente. O aceite destes documentos não autoriza ações externas ou pagamentos.</p>
    </main>
  );
}
