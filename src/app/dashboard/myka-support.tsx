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
  const [tickets, setTickets] = useState<Array<{ id: string; subject: string; status: string; priority: string; updated_at: string; created_at: string }>>([]);
  const [ticketsNotice, setTicketsNotice] = useState("");
  const [selectedTicket, setSelectedTicket] = useState<string | null>(null);
  const [replies, setReplies] = useState<Array<{ id:string;body:string;created_at:string }>>([]);
  const [repliesError, setRepliesError] = useState("");
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [error, setError] = useState("");
  const [seenUpdates, setSeenUpdates] = useState<Record<string, string>>({});
  useEffect(() => {
    function openSupport(event: Event) {
      const detail = (event as CustomEvent<{ topic?: string }>).detail;
      if (detail?.topic && Object.prototype.hasOwnProperty.call(help, detail.topic)) setTopic(detail.topic);
      setOpen(true);
    }
    window.addEventListener("myryra:open-support", openSupport);
    return () => window.removeEventListener("myryra:open-support", openSupport);
  }, []);
  const context = help[activeModule] ?? help.home;
  const selected = topic === "context" ? context : help[topic] ?? context;

  useEffect(() => {
    if (!open || !topic.startsWith("billing-")) return;
    const controller = new AbortController();
    queueMicrotask(() => { if (!controller.signal.aborted) setBillingInfo("Consultando assinatura..."); });
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

  useEffect(() => {
    if (!open) return;
    let active = true;
    queueMicrotask(() => { if (active) void loadTickets(); });
    const interval = window.setInterval(() => { if (document.visibilityState === "visible") void loadTickets(); }, 60000);
    return () => { active = false; window.clearInterval(interval); };
  }, [open]);

  async function loadTickets() {
    setLoadingTickets(true); setTicketsNotice("");
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Faça login para consultar seus chamados.");
      const { data, error: queryError } = await supabase.from("support_tickets").select("id,subject,status,priority,updated_at,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20);
      if (queryError) throw new Error("A consulta de tickets ainda não está habilitada neste ambiente.");
      setTickets(data ?? []);
      setSeenUpdates(previous => {
        const next = { ...previous };
        for (const ticket of data ?? []) if (!next[ticket.id]) next[ticket.id] = ticket.updated_at;
        return next;
      });
      if (!data?.length) setTicketsNotice("Você ainda não possui tickets neste ambiente.");
    } catch (err) { setTicketsNotice(err instanceof Error ? err.message : "Não foi possível consultar os tickets."); }
    finally { setLoadingTickets(false); }
  }

  async function viewReplies(ticketId:string) {
    if(selectedTicket===ticketId) {setSelectedTicket(null);return;}
    setSelectedTicket(ticketId);setReplies([]);setRepliesError("");
    try {
      const response=await fetch("/api/support/replies?ticket="+encodeURIComponent(ticketId),{cache:"no-store"});
      const result=await response.json() as {replies?:Array<{id:string;body:string;created_at:string}>;error?:string};
      if(!response.ok) throw new Error(result.error||"Não foi possível carregar as respostas.");
      setReplies(result.replies??[]);
    }catch(err){setRepliesError(err instanceof Error?err.message:"Consulta indisponível.");}
  }
  const changedTickets = tickets.filter(ticket => seenUpdates[ticket.id] && seenUpdates[ticket.id] !== ticket.updated_at);
  function markUpdatesRead() {
    setSeenUpdates(previous => ({ ...previous, ...Object.fromEntries(tickets.map(ticket => [ticket.id, ticket.updated_at])) }));
  }

  async function send() {
    const trimmed = message.trim();
    if (sending || trimmed.length < 10 || trimmed.length > 1500) return;
    setSending(true); setStatus(""); setError("");
    try {
      const supabase = createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error("Faça login novamente para enviar sua solicitação.");
      const { data: created, error: insertError } = await supabase.from("support_tickets").insert({
        user_id: user.id, category: topic.startsWith("billing-") ? "billing" : "general", subject: selected.title, message: trimmed,
      }).select("id").single();
      if (insertError) throw insertError;
      setStatus("Chamado aberto · protocolo " + created.id.slice(0, 8).toUpperCase() + ". Acompanhe o status abaixo. O prazo de atendimento ainda não está definido.");
      void loadTickets();
      setMessage("");
    } catch (err) { setError(err instanceof Error ? err.message : "Não foi possível registrar a solicitação."); }
    finally { setSending(false); }
  }

  return <div className={`${activeModule === "home" && !open ? "hidden lg:block " : ""}fixed bottom-[calc(6.5rem+env(safe-area-inset-bottom))] right-4 z-30 max-w-[calc(100vw-2rem)] lg:bottom-6 lg:right-8`}>
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
          <label htmlFor="myka-support-message" className="block text-sm font-medium">Ainda precisa de ajuda? Abra um chamado</label>
          <textarea id="myka-support-message" value={message} onChange={e => setMessage(e.target.value)} maxLength={1500} rows={4} placeholder="Descreva sua dúvida ou problema (mínimo 10 caracteres). Não informe dados de pagamento..." className="w-full resize-y rounded-xl border border-slate-700 bg-slate-900 p-3 text-sm text-white placeholder:text-slate-500" />
          <button type="button" onClick={() => void send()} disabled={sending || message.trim().length < 10} className="w-full rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold disabled:opacity-50">{sending ? "Registrando..." : "Abrir chamado"}</button>
          {status && <p role="status" className="text-sm text-emerald-300">{status}</p>}
          {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
          <div className="space-y-2 border-t border-white/10 pt-3">
            <button type="button" onClick={() => void loadTickets()} disabled={loadingTickets} className="text-sm font-medium text-violet-200 underline underline-offset-2">{loadingTickets ? "Consultando..." : "Meus chamados · Atualizar"}</button>
            {ticketsNotice && <p className="text-xs text-slate-400">{ticketsNotice}</p>}
            {changedTickets.length > 0 && <p role="status" className="rounded-lg bg-violet-500/15 p-2 text-xs text-violet-200">{changedTickets.length} chamado(s) atualizado(s) desde sua última consulta.</p>}
            {changedTickets.length > 0 && <button type="button" onClick={markUpdatesRead} className="text-xs text-violet-300 underline">Marcar atualizações como lidas</button>}
            {tickets.map(ticket => <div key={ticket.id} className="rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-slate-300">
              <p className="font-medium text-white">{ticket.subject} · {ticket.id.slice(0, 8).toUpperCase()}</p>
              <p>Status: {({ open: "Aberto", in_progress: "Em análise", resolved: "Resolvido", closed: "Encerrado" } as Record<string,string>)[ticket.status] ?? "Em verificação"} · Prioridade: {({ low: "Baixa", normal: "Normal", high: "Alta", urgent: "Urgente" } as Record<string,string>)[ticket.priority] ?? "Normal"} · {new Date(ticket.created_at).toLocaleDateString("pt-BR")}</p>
              <button type="button" className="mt-2 text-violet-200 underline" onClick={()=>void viewReplies(ticket.id)}>{selectedTicket===ticket.id?"Ocultar respostas":"Ver respostas do suporte"}</button>
              {selectedTicket===ticket.id && <div className="mt-2 space-y-2">{repliesError && <p role="alert">{repliesError}</p>}{!repliesError && replies.length===0 && <p>Ainda não há respostas neste chamado.</p>}{replies.map(reply=><div key={reply.id} className="rounded-lg bg-slate-900 p-2"><p className="text-violet-200">Equipe MYRYRA · {new Date(reply.created_at).toLocaleString("pt-BR")}</p><p className="mt-1 whitespace-pre-wrap break-words">{reply.body}</p></div>)}</div>}
            </div>)}
          </div>
          <p className="text-xs text-slate-400">Ajuda guiada inicial, sem chat com IA nesta versão. Não envie senhas, dados bancários ou chaves.</p>
        </div>
      </div>
    </section>}
    <button type="button" onClick={() => setOpen(v => !v)} aria-expanded={open} aria-label={open ? "Fechar ajuda MYKA" : "Abrir ajuda MYKA"} className="flex h-11 w-11 items-center justify-center gap-2 rounded-full border border-violet-400/50 bg-violet-700 p-2 text-sm lg:h-auto lg:w-auto lg:px-4 lg:py-3 font-semibold text-white shadow-lg shadow-violet-900/50 hover:bg-violet-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300">
      <span aria-hidden="true">✦</span> <span className="hidden lg:inline">{open ? "Fechar ajuda" : "Ajuda MYKA"}</span>
    </button>
  </div>;
}
