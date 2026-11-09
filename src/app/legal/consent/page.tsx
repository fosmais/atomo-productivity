"use client";

import { useEffect, useState } from "react";

type Document = { type: string; version: string; url: string; accepted: boolean };
type Status = { ready: boolean; acceptanceRequired: boolean; documents: Document[]; reason?: string; error?: string };

export default function LegalConsentPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function load() {
    const response = await fetch("/api/legal/acceptance-status", { cache: "no-store" });
    if (response.status === 401) { window.location.assign("/login"); return; }
    const result = (await response.json()) as Status;
    setStatus(result);
    // A refreshed document version must require a fresh, explicit confirmation.
    setTerms(false);
    setPrivacy(false);
    if (!response.ok) setMessage(result.error ?? "Documentos legais ainda não disponíveis.");
  }
  useEffect(() => {
    void load().catch(() => setMessage("Não foi possível consultar os documentos."));
    const refreshOnReturn = () => {
      if (document.visibilityState === "visible") {
        void load().catch(() => setMessage("Não foi possível atualizar os documentos."));
      }
    };
    document.addEventListener("visibilitychange", refreshOnReturn);
    return () => document.removeEventListener("visibilitychange", refreshOnReturn);
  }, []);
  async function submit() {
    if (!status?.ready || !status.documents.every((doc) => doc.accepted || (doc.type === "terms" ? terms : privacy)) || busy) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/legal/accept", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accepted: true,
          versions: Object.fromEntries(status.documents.map((doc) => [doc.type, doc.version])),
        }),
      });
      if (!response.ok) {
        const result = await response.json();
        setMessage(result.error ?? "Não foi possível registrar o aceite.");
        await load();
        return;
      }
      window.location.assign("/dashboard");
      return;
    } catch { setMessage("Falha de conexão. Tente novamente."); }
    finally { setBusy(false); }
  }
  const ready = status?.ready && status.documents.length === 2;
  const confirmed = status?.documents.every((doc) => doc.accepted || (doc.type === "terms" ? terms : privacy)) ?? false;
  return (
    <main className="mx-auto w-full max-w-xl px-5 py-12">
      <h1 className="text-2xl font-semibold">Privacidade e Termos de Uso</h1>
      <p className="mt-3 text-sm opacity-80">Antes de continuar, leia os documentos vigentes da MYRYRA DESENVOLVIMENTO DE SOFTWARE. Sua concordância não será registrada sem confirmação.</p>
      {!status && !message && <p className="mt-6">Carregando documentos…</p>}
      {ready && (
        <section className="mt-8 space-y-5">
          {status.documents.map((doc) => (
            <div key={doc.type} className="rounded-xl border p-4">
              <p className="font-medium">{doc.type === "terms" ? "Termos de Uso" : "Aviso de Privacidade"} — versão {doc.version}</p>
              <a href={doc.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block underline">Ler documento completo</a>
            </div>
          ))}
          {status.acceptanceRequired ? (
            <>
              {!status.documents.find((doc) => doc.type === "terms")?.accepted && <label className="flex gap-3"><input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} /> Li e concordo com os Termos de Uso vigentes.</label>}
              {!status.documents.find((doc) => doc.type === "privacy_notice")?.accepted && <label className="flex gap-3"><input type="checkbox" checked={privacy} onChange={(e) => setPrivacy(e.target.checked)} /> Li e estou ciente do Aviso de Privacidade vigente.</label>}
              <button type="button" disabled={!confirmed || busy} onClick={() => void submit()} className="rounded-xl bg-violet-700 px-5 py-3 font-semibold text-white disabled:opacity-50">{busy ? "Registrando…" : "Confirmar e continuar"}</button>
            </>
          ) : <p>Seus aceites estão atualizados. <a className="underline" href="/dashboard">Ir para a MYRYRA</a></p>}
        </section>
      )}
      {message && <p role="status" className="mt-5 text-sm">{message}</p>}
    </main>
  );
}
