"use client";

import { useEffect, useState } from "react";

type DocumentStatus = { type: "terms" | "privacy"; version: string; accepted: boolean };
type LegalStatus = { accepted: boolean; documents: DocumentStatus[] };

export function MyryraLegalAcceptance({ onAccepted }: { onAccepted?: () => void }) {
  const [status, setStatus] = useState<LegalStatus | null>(null);
  const [termsChecked, setTermsChecked] = useState(false);
  const [privacyChecked, setPrivacyChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const termsUrl = process.env.NEXT_PUBLIC_MYRYRA_TERMS_URL;
  const privacyUrl = process.env.NEXT_PUBLIC_MYRYRA_PRIVACY_URL;
  const validUrl = (url: string | undefined) => {
    if (!url) return false;
    try { return new URL(url).protocol === "https:"; } catch { return false; }
  };
  const documentsPublished = validUrl(termsUrl) && validUrl(privacyUrl);

  async function refresh() {
    const response = await fetch("/api/legal/status", { credentials: "same-origin", cache: "no-store" });
    if (!response.ok) throw new Error("Não foi possível consultar as versões legais.");
    const data: LegalStatus = await response.json();
    if (!Array.isArray(data.documents) || data.documents.length !== 2)
      throw new Error("Documentos legais indisponíveis.");
    setStatus(data);
    if (data.accepted) onAccepted?.();
  }

  useEffect(() => {
    let mounted = true;
    fetch("/api/legal/status", { credentials: "same-origin", cache: "no-store" })
      .then(async response => {
        if (!response.ok) throw new Error("Documentos legais indisponíveis.");
        return response.json() as Promise<LegalStatus>;
      })
      .then(data => { if (mounted) setStatus(data); })
      .catch(() => { if (mounted) setError("Não foi possível consultar os termos. Tente novamente."); });
    return () => { mounted = false; };
  }, []);

  async function accept() {
    if (!documentsPublished || !termsChecked || !privacyChecked || !status || busy) return;
    const terms = status.documents.find(item => item.type === "terms");
    const privacy = status.documents.find(item => item.type === "privacy");
    if (!terms || !privacy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/legal/accept", {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          terms_version: terms.version, privacy_version: privacy.version,
          accept_terms: true, acknowledge_privacy: true
        })
      });
      if (!response.ok) throw new Error("Não foi possível registrar seu aceite.");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao registrar aceite.");
    } finally {
      setBusy(false);
    }
  }

  if (status?.accepted) return <p role="status" className="text-sm">Documentos atuais confirmados.</p>;
  return (
    <section aria-label="Termos e privacidade da MYRYRA" className="space-y-3 rounded-xl border p-4">
      <h2 className="font-semibold">Termos de Uso e Privacidade</h2>
      <p className="text-sm">Para usar a MIKA Agente, consulte os documentos atuais e confirme sua decisão. Nenhum aceite é presumido.</p>
      {!documentsPublished && <p role="alert" className="text-sm">Os documentos ainda não foram publicados. O aceite está indisponível.</p>}
      {status && documentsPublished && (
        <>
          <p className="text-sm"><a href={termsUrl} target="_blank" rel="noopener noreferrer" className="underline">Ler Termos de Uso (versão {status.documents.find(d => d.type === "terms")?.version})</a></p>
          <p className="text-sm"><a href={privacyUrl} target="_blank" rel="noopener noreferrer" className="underline">Ler Política de Privacidade (versão {status.documents.find(d => d.type === "privacy")?.version})</a></p>
          <label className="flex gap-2 text-sm"><input type="checkbox" checked={termsChecked} onChange={e => setTermsChecked(e.target.checked)} /> Li e aceito os Termos de Uso.</label>
          <label className="flex gap-2 text-sm"><input type="checkbox" checked={privacyChecked} onChange={e => setPrivacyChecked(e.target.checked)} /> Li e estou ciente da Política de Privacidade.</label>
          <button type="button" onClick={accept} disabled={!termsChecked || !privacyChecked || busy} className="rounded-lg border px-4 py-2 disabled:opacity-50">
            {busy ? "Registrando..." : "Confirmar"}
          </button>
        </>
      )}
      {error && <p role="alert" className="text-sm">{error}</p>}
    </section>
  );
}
