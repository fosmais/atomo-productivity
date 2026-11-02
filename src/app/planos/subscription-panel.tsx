"use client";

import { useEffect, useState } from "react";

type Subscription = {
  planId: string;
  status: string;
  provider: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
};
type ResponseData = { subscription: Subscription | null; checkoutEnabled: boolean };

const labels: Record<string, string> = {
  active: "Ativa", trialing: "Em teste", past_due: "Pagamento pendente",
  canceled: "Cancelada", unpaid: "Não paga", incomplete: "Aguardando confirmação",
};

export function FreePlanAction() {
  const [state, setState] = useState<"loading" | "authenticated" | "unknown" | "guest">("loading");
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/billing/subscription", { cache: "no-store", signal: controller.signal })
      .then((response) => {
        if (controller.signal.aborted) return;
        setState(response.ok ? "authenticated" : response.status === 401 || response.status === 403 ? "unknown" : "unknown");
      })
      .catch(() => { if (!controller.signal.aborted) setState("unknown"); });
    return () => controller.abort();
  }, []);
  if (state === "authenticated") return <div className="mt-8 rounded-xl border border-violet-500/50 bg-violet-500/10 px-4 py-3 text-center text-sm font-semibold text-violet-200">Seu plano atual</div>;
  if (state === "loading" || state === "unknown") return <div className="mt-8 rounded-xl border border-white/15 px-4 py-3 text-center text-sm text-zinc-300">{state === "loading" ? "Verificando seu plano…" : "Consulte seu plano após entrar na conta"}</div>;
  return <a href="/login?mode=signup" className="mt-8 block rounded-xl bg-violet-600 px-4 py-3 text-center text-sm font-semibold text-white">Criar minha conta grátis</a>;
}

export default function SubscriptionPanel() {
  const [status, setStatus] = useState<"loading" | "ready" | "unauthorized" | "error">("loading");
  const [data, setData] = useState<ResponseData | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/billing/subscription", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (response.status === 401 || response.status === 403) { setStatus("unauthorized"); return; }
        if (!response.ok) throw new Error("Subscription lookup failed");
        const payload = (await response.json()) as ResponseData;
        if (!controller.signal.aborted) { setData(payload); setStatus("ready"); }
      })
      .catch(() => { if (!controller.signal.aborted) setStatus("error"); });
    return () => controller.abort();
  }, []);

  return (
    <section aria-label="Minha assinatura" className="mt-10 rounded-3xl border border-white/15 bg-slate-900/90 p-6">
      <h2 className="text-xl font-semibold">Minha assinatura</h2>
      {status === "loading" && <p className="mt-3 text-sm text-zinc-300">Consultando assinatura…</p>}
      {status === "unauthorized" && <p className="mt-3 text-sm text-zinc-300">Entre na sua conta e conclua a verificação de segurança para consultar sua assinatura.</p>}
      {status === "error" && <p role="status" className="mt-3 text-sm text-zinc-300">Não foi possível consultar sua assinatura agora.</p>}
      {status === "ready" && !data?.subscription && <p className="mt-3 text-sm text-zinc-300">Nenhuma assinatura paga registrada. Seu acesso permanece no plano Free.</p>}
      {status === "ready" && data?.subscription && (
        <div className="mt-4 space-y-2 text-sm text-zinc-200">
          <p>Plano registrado: <strong className="text-white">{data.subscription.planId === "premium" ? "Premium" : data.subscription.planId === "pro" ? "Pro" : "Free"}</strong></p>
          <p>Situação: <strong className="text-white">{labels[data.subscription.status] ?? "Em verificação"}</strong></p>
          {data.subscription.currentPeriodEnd && !Number.isNaN(Date.parse(data.subscription.currentPeriodEnd)) && (
            <p>Fim do período registrado: {new Date(data.subscription.currentPeriodEnd).toLocaleDateString("pt-BR")}</p>
          )}
          {data.subscription.cancelAtPeriodEnd && <p>Cancelamento programado para o fim do período.</p>}
          <p className="text-xs text-zinc-400">O acesso efetivo depende da confirmação de pagamento e das regras de assinatura.</p>
        </div>
      )}
      <p className="mt-4 text-xs text-violet-200">Contratações, alterações e cancelamentos estarão disponíveis após a homologação do Asaas.</p>
    </section>
  );
}
