"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useVyraNavigation } from "./vyra-module-context";

const help: Record<string, { title: string; answer: string }> = {
  home: { title: "Hoje", answer: "Na tela Hoje você acompanha suas prioridades e acessa rapidamente o planejamento. Para personalizar sua rotina, abra Planner → Preferências de planejamento." },
  "vyra-ai": { title: "MYKA AI", answer: "Na MYKA AI você pode conversar sobre tarefas e planejamento. Este painel é dedicado a dúvidas sobre o uso da plataforma." },
  "vyra-planner": { title: "Planner", answer: "Abra Preferências de planejamento no início do Planner para configurar sua rotina. Depois, utilize as ferramentas de planejamento." },
  "vyra-tasks": { title: "Tarefas", answer: "Na tela Tarefas você acompanha suas atividades. Para importar tarefas CSV, vá a Preferências → Integrações de produtividade." },
  "vyra-calendar": { title: "Agenda", answer: "Na Agenda você visualiza compromissos. Para importar um calendário ICS ou configurar Google Calendar, abra Preferências → Integrações de produtividade." },
  "vyra-scheduling": { title: "Smart Scheduling", answer: "O Smart Scheduling ajuda a encontrar horários no seu planejamento. Confira primeiro se sua Agenda está atualizada." },
  "vyra-performance": { title: "Performance", answer: "A tela Performance apresenta indicadores de produtividade com base nas atividades disponíveis na MYRYRA." },
  "billing-plans": { title: "Planos e assinaturas", answer: "Consulte as opções de planos e os recursos disponíveis na área de Planos da MYRYRA. Para solicitar alteração de plano ou esclarecer condições de assinatura, registre uma solicitação abaixo. Não informe dados completos de cartão." },
  "billing-payments": { title: "Pagamentos e cobranças", answer: "Para dúvidas sobre cobrança, pagamento não reconhecido, falha na confirmação ou renovação, informe o plano, a data e uma descrição do ocorrido. Não envie número de cartão, CVV, senhas ou dados bancários." },
  "billing-cancel": { title: "Cancelamento e reembolso", answer: "Se precisar de ajuda com cancelamento, renovação ou reembolso, descreva sua solicitação abaixo. A abertura do chamado não cancela automaticamente uma assinatura nem confirma um reembolso." },
  "vyra-settings": { title: "Preferências", answer: "Em Preferências você encontra segurança da conta, integrações de produtividade e feedback. Nunca compartilhe senhas ou chaves de API em solicitações." },
};

export default function MykaSupport() {
  const { activeModule } = useVyraNavigation();
  const [open, setOpen] = useState(false);
  const [billingInfo, setBillingInfo] = useState("Consultando assinatura...");
  const [message, setMessage] = useState("");
  const [topic, setTopic] = useState("context");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState("");
  const [tickets, setTickets] = useState<Array<{ id: string; subject: string; status: string; created_at: string }>>([]);
  const [ticketsNotice, setTicketsNotice] = useState("");
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [error, setError] = useState("");
  const context = help[activeModule] ?? help.home;
  const selected = topic === "context" ? context : help[topic] ?? context;

  useEffect(() => {
    if (!open || !topic.startsWith("billing-")) return;
    const controller = new AbortController();
    setBillingInfo("Consultando assinatura...");
    fetch("/api/billing/subscription", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (response.status === 401 || response.status === 403) return "Entre na sua conta para consultar sua assinatura.";
        if (!response.ok) throw new Error("Consulta indisponível");
        const data = await response.json() as { subscription?: { planId?: string; status?: string } | null };
        if (!data.subscription) return "Nenhuma assinatura paga registrada. Plano Free.";
        const plan = data.subscription.planId === "premium" ? "Premium" : data.subscription.planId === "pro" ? "Pro" : "Não identificado";
        const status = ({ active: "ativa", trialing: "em teste", past_due: "pagamento pendente", canceled: "cancelada", unpaid: "não paga", incomplete: "aguardando confirmação" } as Record<string, string>)[data.subscription.status ?? ""] ?? "em verificação";
        return "Assinatura registrada: " + plan + " · situação: " + status + ".";
      })
      .then((value) => { if (!controller.signal.aborted) setBillingInfo(value); })
      .catch(() => { if (!controller.signal.aborted) setBillingInfo("Não foi possível consultar sua assinatura agora."); });
    return () => controller.abort();
  }, [open, topic]);

  async function loadTickets() {
    setLoadingTickets(true); setTicketsNotice("");
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Faça login para consultar seus chamados.");
      const { data, error: queryError } = await supabase.from("support_tickets").select("id,subject,status,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20);
      if (queryError) throw new Error("A consulta de tickets ainda não está habilitada neste ambiente.");
      setTickets(data ?? []);
      if (!data?.length) setTicketsNotice("Você ainda não possui tickets neste ambiente.");
    } catch (err) { setTicketsNotice(err instanceof Error ? err.message : "Não foi possível consultar os tickets."); }
    finally { setLoadingTickets(false); }
  }

  async function send() {
    const trimmed = message.trim();
    if (sending || trimmed.length < 10 || trimmed.length > 1500) return;
    setSending(true); setStatus(""); setError("");
    try {
      const supabase = createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error("Faça login novamente para enviar sua solicitação.");
      const { error: insertError } = await supabase.from("beta_feedback").insert({
        user_id: user.id, category: "problema", message: "[Suporte MYKA · " + context.title + " · assunto: " + selected.title + "] " + trimmed,
      });
      if (insertError) throw insertError;
      setStatus("Solicitação registrada. O atendimento humano ainda não está disponível nesta versão.");
      setMessage("");
    } catch (err) { setError(err instanceof Error ? err.message : "Não foi possível registrar a solicitação."); }
    finally { setSending(false); }
  }

  return <div className="fixed bottom-20 right-4 z-50 lg:bottom-5 lg:right-6">
    {open && <section role="dialog" aria-label="Ajuda e suporte MYKA" className="mb-3 flex max-h-[min(75vh,620px)] w-[min(92vw,380px)] flex-col overflow-hidden rounded-2xl border border-violet-400/40 bg-slate-950 text-white shadow-2xl shadow-violet-950/60">
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div><h3 className="font-semibold">MYKA · Ajuda e suporte</h3><p className="text-xs text-slate-400">Ajuda contextual · {context.title}</p></div>
        <button type="button" aria-label="Fechar suporte" onClick={() => setOpen(false)} className="rounded-lg px-2 py-1 text-slate-300 hover:bg-white/10">✕</button>
      </header>
      <div className="space-y-4 overflow-y-auto p-4">
        <div className="space-y-2"><label htmlFor="myka-help-topic" className="block text-xs font-medium text-slate-300">Sobre o que você precisa de ajuda?</label><select id="myka-help-topic" value={topic} onChange={e => setTopic(e.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-900 p-2.5 text-sm text-white"><option value="context">Esta tela: {context.title}</option>{Object.entries(help).filter(([key]) => key !== activeModule).map(([key, item]) => <option key={key} value={key}>{item.title}</option>)}</select></div>
        <div className="rounded-xl bg-violet-500/10 p-3 text-sm leading-6 text-slate-200"><strong className="text-violet-200">Como usar {selected.title}?</strong><p className="mt-1">{selected.answer}</p></div>
        {topic.startsWith("billing-") && <p role="status" className="rounded-xl border border-violet-400/20 bg-violet-500/10 p-3 text-sm text-slate-200">{billingInfo}</p>}
        {topic.startsWith("billing-") && (
          <a href="/planos" className="inline-flex rounded-xl border border-violet-400/40 px-4 py-2 text-sm font-semibold text-violet-200 hover:bg-violet-500/10">
            Ver planos e assinaturas →
          </a>
        )}
        <div className="space-y-2">
          <label htmlFor="myka-support-message" className="block text-sm font-medium">Ainda precisa de ajuda? Registre uma solicitação</label>
          <textarea id="myka-support-message" value={message} onChange={e => setMessage(e.target.value)} maxLength={1500} rows={4} placeholder="Descreva o problema (mínimo 10 caracteres)..." className="w-full resize-y rounded-xl border border-slate-700 bg-slate-900 p-3 text-sm text-white placeholder:text-slate-500" />
          <button type="button" onClick={() => void send()} disabled={sending || message.trim().length < 10} className="w-full rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold disabled:opacity-50">{sending ? "Registrando..." : "Registrar solicitação"}</button>
          {status && <p role="status" className="text-sm text-emerald-300">{status}</p>}
          {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
          <p className="text-xs text-slate-400">Ajuda guiada inicial, sem chat com IA nesta versão. Não envie senhas, dados bancários ou chaves.</p>
        </div>
      </div>
    </section>}
    <button type="button" onClick={() => setOpen(v => !v)} aria-expanded={open} aria-label={open ? "Fechar ajuda MYKA" : "Abrir ajuda MYKA"} className="flex items-center gap-2 rounded-full border border-violet-400/50 bg-violet-700 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-900/50 hover:bg-violet-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300">
      <span aria-hidden="true">✦</span> {open ? "Fechar ajuda" : "Ajuda MYKA"}
    </button>
  </div>;
}
