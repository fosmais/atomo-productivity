"use client";

import { useState } from "react";
import Link from "next/link";

type Run = { id: number; status: string; conclusion: string | null; url: string; created_at: string };
export default function StagingBootstrapPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function refresh() {
    const response = await fetch("/api/internal/staging-bootstrap", { cache: "no-store" });
    if (!response.ok) { setMessage("Área indisponível para esta conta ou ambiente."); return; }
    const data = await response.json();
    setConfigured(data.configured);
    setRuns(data.runs ?? []);
    if (data.message) setMessage(data.message);
  }
  // Initial data is loaded by an explicit user action; no effect-driven state cascade.
  async function bootstrap() {
    if (!window.confirm("Criar ou verificar duas contas sintéticas SOMENTE em staging? Nenhuma ação em produção será executada.")) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/internal/staging-bootstrap", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "bootstrap" }),
      });
      const data = await response.json();
      setMessage(data.message ?? data.error ?? "Não foi possível solicitar o bootstrap.");
      if (response.ok) await refresh();
    } catch { setMessage("Falha de comunicação. Tente novamente."); }
    finally { setBusy(false); }
  }
  return (
    <main className="mx-auto min-h-screen max-w-3xl space-y-6 bg-slate-950 px-5 py-10 text-slate-100">
      <Link href="/dashboard" className="text-sm text-violet-300">← Voltar à MYRYRA</Link>
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-violet-300">MYRYRA · Operação interna</p>
        <h1 className="text-2xl font-semibold">Homologação da MIKA</h1>
        <p className="text-sm text-slate-300">Painel restrito à administração, disponível apenas em Preview. Executa exclusivamente o bootstrap de identidades sintéticas na branch de homologação.</p>
      </header>
      <section className="space-y-4 rounded-2xl border border-violet-400/20 bg-slate-900 p-5">
        <h2 className="font-semibold">Contas sintéticas</h2>
        <p className="text-sm text-slate-300">A execução exige os segredos do ambiente staging configurados no GitHub Actions. O painel não solicita nem exibe senhas ou tokens.</p>
        <button type="button" disabled={busy || configured !== true} onClick={bootstrap} className="rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
          {busy ? "Solicitando..." : "Preparar duas contas de teste"}
        </button>
        {message && <p role="status" className="text-sm text-amber-200">{message}</p>}
      </section>
      <section className="space-y-3 rounded-2xl border border-white/10 bg-slate-900 p-5">
        <div className="flex items-center justify-between gap-3"><h2 className="font-semibold">Últimas execuções</h2><button type="button" onClick={() => void refresh()} className="text-sm text-violet-300">Atualizar</button></div>
        {runs.length === 0 && <p className="text-sm text-slate-400">Nenhuma execução disponível.</p>}
        {runs.map(run => <a key={run.id} href={run.url} target="_blank" rel="noopener noreferrer" className="flex justify-between gap-3 rounded-xl border border-white/10 p-3 text-sm hover:border-violet-400/50"><span>{new Date(run.created_at).toLocaleString("pt-BR")}</span><span>{run.conclusion ?? run.status}</span></a>)}
      </section>
      <p className="text-xs text-slate-400">Este painel não aprova propostas, não executa concorrência e não publica alterações em produção.</p>
    </main>
  );
}
