"use client";

import { useEffect, useState } from "react";

type Doc = { id: string; version: string; public_url: string };
type Status = { configured: boolean; terms: Doc | null; notice: Doc | null; accepted: boolean; acknowledged: boolean; complete?: boolean };

export default function LegalOnboarding() {
  const [status, setStatus] = useState<Status | null>(null);
  const [agree, setAgree] = useState(false);
  const [readNotice, setReadNotice] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/privacy/onboarding", { cache: "no-store" }).then(async r => {
      if (!r.ok) throw Error("Não foi possível consultar os documentos.");
      setStatus(await r.json());
    }).catch(e => setError(e instanceof Error ? e.message : "Erro de conexão."));
  }, []);

  async function submit() {
    if (!status?.configured || !status.terms || !status.notice || !agree || !readNotice || busy) return;
    setBusy(true);
    setError("");
    try {
      const actions = [
        { documentVersionId: status.terms.id, action: "accepted" },
        { documentVersionId: status.notice.id, action: "acknowledged" },
      ];
      for (const item of actions) {
        const response = await fetch("/api/privacy/consents", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...item, source: "registration", requestId: crypto.randomUUID() }),
        });
        if (!response.ok) throw Error("Não foi possível registrar os aceites. Tente novamente.");
      }
      const check = await fetch("/api/privacy/onboarding", { cache: "no-store" });
      if (!check.ok || !(await check.json()).complete) throw Error("Não foi possível confirmar os registros.");
      window.location.assign("/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao registrar.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="mx-auto w-full max-w-xl px-4 py-10">
    <h1 className="text-3xl font-semibold">Bem-vindo à MYRYRA</h1>
    <p className="mt-3 text-sm opacity-75">Antes de começar, conheça os documentos que regem o serviço e o tratamento dos seus dados.</p>
    {error && <p role="alert" className="mt-4 rounded-xl border p-3 text-sm">{error}</p>}
    {!status && !error && <p className="mt-6">Carregando…</p>}
    {status && !status.configured && <section className="mt-6 rounded-2xl border p-5">
      <h2 className="font-semibold">Documentos em preparação</h2>
      <p className="mt-2 text-sm">Os documentos oficiais ainda não foram publicados. Não é possível registrar um aceite neste momento.</p>
    </section>}
    {status?.configured && status.terms && status.notice && <>
      <section className="mt-6 space-y-4 rounded-2xl border p-5">
        <h2 className="text-lg font-semibold">Documentos legais</h2>
        <a className="block underline" href={status.terms.public_url} target="_blank" rel="noopener noreferrer">Termos de Uso — versão {status.terms.version}</a>
        <a className="block underline" href={status.notice.public_url} target="_blank" rel="noopener noreferrer">Aviso de Privacidade — versão {status.notice.version}</a>
        <label className="flex gap-3 text-sm"><input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} /> Li e aceito os Termos de Uso.</label>
        <label className="flex gap-3 text-sm"><input type="checkbox" checked={readNotice} onChange={e => setReadNotice(e.target.checked)} /> Declaro ciência do Aviso de Privacidade.</label>
      </section>
      <p className="mt-4 text-xs opacity-70">As autorizações opcionais para personalização, análises e marketing são independentes e poderão ser gerenciadas na Central de Privacidade.</p>
      <button type="button" disabled={!agree || !readNotice || busy} onClick={() => void submit()}
        className="mt-5 rounded-xl border px-5 py-3 font-semibold disabled:opacity-50">{busy ? "Registrando…" : "Confirmar e continuar"}</button>
    </>}
  </main>;
}
