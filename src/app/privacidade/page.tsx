"use client";

import { useCallback, useEffect, useState } from "react";

type Purpose = { purpose_key: string; purpose_version: number; display_name: string; description: string; required: boolean; legal_basis: string };
type Notice = { id: string; public_url: string; version: string };
type Choice = { purpose_key: string; purpose_version: number; granted: boolean; occurred_at: string };

export default function PrivacyCenter() {
  const [purposes, setPurposes] = useState<Purpose[]>([]);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [choices, setChoices] = useState<Choice[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const [catalog, history] = await Promise.all([
        fetch("/api/privacy/catalog", { cache: "no-store" }),
        fetch("/api/privacy/consents", { cache: "no-store" }),
      ]);
      if (!catalog.ok || !history.ok) throw new Error("Não foi possível carregar suas preferências.");
      const c = await catalog.json();
      const h = await history.json();
      setPurposes(c.purposes ?? []);
      setNotice(c.notice ?? null);
      setChoices(h.choices ?? []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro ao carregar.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  async function update(purpose: Purpose, granted: boolean) {
    if (!notice || busy) return;
    setBusy(purpose.purpose_key);
    setMessage("");
    try {
      const response = await fetch("/api/privacy/choices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purposeKey: purpose.purpose_key,
          purposeVersion: purpose.purpose_version,
          noticeVersionId: notice.id,
          granted,
          source: "settings",
          requestId: crypto.randomUUID(),
        }),
      });
      if (!response.ok) throw new Error("Não foi possível salvar a preferência.");
      await refresh();
      setMessage(granted ? "Autorização registrada." : "Revogação registrada.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro ao salvar.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <a href="/dashboard" className="text-sm underline underline-offset-4">Voltar à MYRYRA</a>
      <h1 className="mt-6 text-3xl font-semibold">Central de Privacidade</h1>
      <p className="mt-2 text-sm opacity-75">Você controla as autorizações opcionais. Recusar não impede o uso das funções essenciais da MYRYRA.</p>
      {message && <p role="status" className="mt-4 rounded-xl border p-3 text-sm">{message}</p>}
      {loading ? <p className="mt-6">Carregando preferências…</p> : (
        <section className="mt-6 grid gap-4 sm:grid-cols-2">
          {purposes.filter(p => !p.required && p.legal_basis === "consent").map(p => {
            const latest = choices.filter(c => c.purpose_key === p.purpose_key && c.purpose_version === p.purpose_version)
              .sort((a, b) => Date.parse(b.occurred_at) - Date.parse(a.occurred_at))[0];
            const enabled = latest?.granted === true;
            return (
              <article key={p.purpose_key} className="rounded-2xl border p-5 shadow-sm">
                <h2 className="text-lg font-semibold">{p.display_name}</h2>
                <p className="mt-2 text-sm opacity-75">{p.description}</p>
                <p className="mt-3 text-sm">Status: <strong>{enabled ? "Autorizado" : "Não autorizado"}</strong></p>
                <button type="button" disabled={busy !== null || !notice}
                  onClick={() => void update(p, !enabled)}
                  className="mt-4 rounded-xl border px-4 py-2 text-sm font-semibold disabled:opacity-50">
                  {busy === p.purpose_key ? "Salvando…" : enabled ? "Revogar autorização" : "Autorizar"}
                </button>
              </article>
            );
          })}
          {purposes.length === 0 && <p className="text-sm">Nenhuma finalidade opcional publicada no momento.</p>}
        </section>
      )}
      {notice && <p className="mt-6 text-sm"><a className="underline" href={notice.public_url} target="_blank" rel="noopener noreferrer">Ler Aviso de Privacidade — versão {notice.version}</a></p>}
      <p className="mt-4 text-xs opacity-70">Suas escolhas são registradas para fins de transparência. Autorizações para integrações externas também podem precisar ser revogadas no respectivo provedor.</p>
    </main>
  );
}
