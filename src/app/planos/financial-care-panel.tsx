"use client";

import { useCallback, useEffect, useState } from "react";

type Protocol = {
  id: string;
  action: "cancel_renewal" | "downgrade" | "request_refund";
  target_plan: string | null;
  status: string;
  created_at: string;
  effective_at: string | null;
};
const actionNames: Record<string, string> = {
  cancel_renewal: "Cancelamento da renovação",
  downgrade: "Mudança de plano",
  request_refund: "Solicitação de estorno",
};
const statusNames: Record<string, string> = {
  pending_review: "Em análise", approved: "Aprovada", processing: "Em processamento",
  completed: "Concluída", rejected: "Não aprovada", needs_recovery: "Verificação necessária",
};

export default function FinancialCarePanel() {
  const [requests, setRequests] = useState<Protocol[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "unavailable" | "signin">("loading");
  const [message, setMessage] = useState("");
  const [historyUnavailable, setHistoryUnavailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showCancellation, setShowCancellation] = useState(false);
  const [subscription, setSubscription] = useState<{planId:string;status:string;provider:string|null;currentPeriodEnd:string|null}|null>(null);

  const refresh = useCallback(async () => {
    try {
      const [history, sub] = await Promise.all([
        fetch("/api/billing/financial-care/history", { cache: "no-store" }),
        fetch("/api/billing/subscription", { cache: "no-store" }),
      ]);
      if (history.status === 401 || history.status === 403 || sub.status === 401 || sub.status === 403) {
        setState("signin"); return;
      }
      if (!sub.ok) { setState("unavailable"); return; }
      const subscriptionData = await sub.json();
      setSubscription(subscriptionData.subscription ?? null);
      setHistoryUnavailable(!history.ok);
      if (history.ok) {
        const historyData = await history.json();
        setRequests(Array.isArray(historyData.requests) ? historyData.requests : []);
      } else {
        setRequests([]);
      }
      setState("ready");
    } catch { setState("unavailable"); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  async function submit(action: "cancel_renewal" | "downgrade", targetPlan?: "free" | "pro") {
    if (busy) return;
    const verb = action === "cancel_renewal" ? "solicitar o cancelamento da próxima renovação" : `solicitar a mudança para o plano ${targetPlan?.toUpperCase()} no próximo ciclo`;
    if (!window.confirm(`Deseja ${verb}? Este pedido será registrado para análise e não altera sua cobrança imediatamente.`)) return;
    setBusy(true); setMessage("");
    try {
      const res = await fetch("/api/billing/financial-care/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({ action, confirmed: true, ...(targetPlan ? { targetPlan } : {}) }),
      });
      const payload = await res.json();
      if (!res.ok) { setMessage(payload.error || "Não foi possível registrar a solicitação."); return; }
      setMessage(`Solicitação recebida para análise. Protocolo: ${payload.protocol}. Nenhuma alteração financeira foi executada.`);
      await refresh();
    } catch { setMessage("Falha de conexão. Confira o histórico antes de tentar novamente."); }
    finally { setBusy(false); }
  }

  const eligible = subscription?.provider === "asaas" && ["active","trialing"].includes(subscription.status);
  return (
    <section className="mt-8 rounded-3xl border border-white/15 bg-slate-900/90 p-6" aria-label="Atendimento financeiro MIKA">
      <h2 className="text-xl font-semibold text-white">Atendimento de assinatura com a MIKA</h2>
      <p className="mt-2 text-sm text-zinc-300">Tire dúvidas sobre cobrança, conheça alternativas de plano e acompanhe suas solicitações. Alterações financeiras dependem de confirmação e homologação.</p>
      {state === "loading" && <p className="mt-4 text-sm text-zinc-300">Carregando atendimento financeiro…</p>}
      {state === "signin" && <p className="mt-4 text-sm text-zinc-300">Entre na conta e conclua a verificação de segurança para gerenciar sua assinatura.</p>}
      {state === "unavailable" && <p role="status" className="mt-4 text-sm text-amber-200">Autoatendimento ainda não habilitado. Nenhuma alteração financeira será realizada.</p>}
      {state === "ready" && (
        <>
          <div className="mt-5 flex flex-wrap gap-3">
            {subscription?.planId === "premium" && <button type="button" disabled={!eligible || busy} onClick={() => void submit("downgrade", "pro")} className="rounded-xl border border-white/20 px-4 py-3 text-sm font-medium text-white disabled:opacity-40">Mudar para Pro</button>}
            {(subscription?.planId === "premium" || subscription?.planId === "pro") && <button type="button" disabled={!eligible || busy} onClick={() => void submit("downgrade", "free")} className="rounded-xl border border-white/20 px-4 py-3 text-sm font-medium text-white disabled:opacity-40">Mudar para Free</button>}
          </div>
          <p className="mt-3 text-xs text-zinc-400">Estornos precisam de verificação do pagamento. Solicite análise pelo suporte; não há estorno automático nesta versão.</p>
          {!eligible && <p className="mt-2 text-xs text-amber-200">Nenhuma assinatura Asaas ativa elegível para alterações foi encontrada.</p>}
          {eligible && (
            <div className="mt-6 border-t border-white/10 pt-4">
              <p className="text-sm text-zinc-300">Se os planos atuais não atendem às suas necessidades, podemos avaliar alternativas. Você também pode solicitar o cancelamento da renovação a qualquer momento.</p>
              {!showCancellation ? (
                <button type="button" onClick={() => setShowCancellation(true)} className="mt-3 text-sm text-zinc-300 underline underline-offset-4 hover:text-white">Opções de cancelamento</button>
              ) : (
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <button type="button" disabled={busy} onClick={() => void submit("cancel_renewal")} className="rounded-xl border border-white/20 px-4 py-3 text-sm text-white disabled:opacity-40">Solicitar cancelamento da renovação</button>
                  <button type="button" onClick={() => setShowCancellation(false)} className="text-sm text-zinc-300 underline">Voltar</button>
                </div>
              )}
            </div>
          )}
          <h3 className="mt-7 text-base font-semibold text-white">Meus protocolos</h3>
          {historyUnavailable && <p role="status" className="mt-2 text-sm text-amber-200">O histórico de protocolos ainda não está disponível neste ambiente. A consulta de assinatura continua acessível.</p>}
          {historyUnavailable ? null : requests.length === 0 ? <p className="mt-2 text-sm text-zinc-400">Nenhuma solicitação registrada.</p> : (
            <ul className="mt-3 space-y-3">
              {requests.map((item) => <li key={item.id} className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm">
                <p className="font-medium text-white">{actionNames[item.action] ?? "Solicitação"} · {statusNames[item.status] ?? "Em verificação"}</p>
                <p className="mt-1 break-all text-xs text-zinc-400">Protocolo: {item.id}</p>
                <p className="mt-1 text-xs text-zinc-400">Registrado em {new Date(item.created_at).toLocaleDateString("pt-BR")}</p>
              </li>)}
            </ul>
          )}
          <button type="button" onClick={() => void refresh()} className="mt-4 text-sm text-violet-300 underline">Atualizar protocolos</button>
        </>
      )}
      {message && <p role="status" className="mt-4 rounded-xl border border-white/15 p-3 text-sm text-violet-100">{message}</p>}
    </section>
  );
}
