"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";

type Message = { role: "user" | "assistant"; text: string };
const welcome = "Olá! Sou a MIKA 💜 A inteligência pessoal da MYRYRA. Aqui posso explicar planos, recursos e pagamentos; dentro da plataforma, ajudo você a planejar e priorizar sua rotina.";
function answer(question: string): string {
 const q = question.toLocaleLowerCase("pt-BR");
 if (/cart[aã]o|pix|pagamento|cobran|assinar|checkout|comprar/.test(q)) return "As assinaturas e cobranças ainda não estão disponíveis. O checkout está em preparação; não informe dados de cartão nesta conversa.";
 if (/premium/.test(q)) return "O Premium está previsto por R$ 49,90/mês, com 250 interações de IA por dia, recursos Pro, insights avançados e metas pessoais. Valores e recursos ainda estão em homologação.";
 if (/pro/.test(q)) return "O Pro está previsto por R$ 29,90/mês, com 100 interações de IA por dia, Smart Calendar, What Now?, Daily Briefing, AutoPilot e Weekly Intelligence. Ainda não está disponível para contratação.";
 if (/gr[aá]tis|gratuito|free/.test(q)) return "O Free está previsto como gratuito, com 10 interações de IA por dia, agenda, tarefas, calendário básico e What Now? básico.";
 if (/pre[cç]o|valor|quanto|plano|diferen|limite/.test(q)) return "Planos previstos: Free (R$ 0), Pro (R$ 29,90/mês) e Premium (R$ 49,90/mês). Os limites indicativos são 10, 100 e 250 interações de IA por dia, respectivamente. Nada está sendo cobrado nesta versão.";
 if (/agenda|calend[aá]rio|smart|autopilot|what now|recurso|funciona/.test(q)) return "A MYRYRA organiza agenda e tarefas e prevê ferramentas de planejamento com IA. Smart Calendar, AutoPilot e análises avançadas aparecem nos planos superiores; a disponibilidade está em homologação.";
 return "Posso ajudar com preços, diferenças entre Free, Pro e Premium, recursos e formas de pagamento. Para outras perguntas sobre sua rotina, entre na MYRYRA e converse com a MIKA para planejar sua rotina.";
}
export default function MykaPlanHelp({onStartFree}:{onStartFree:()=>void}) {
 const [open,setOpen] = useState(false);
 const [messages, setMessages] = useState<Message[]>([{role:"assistant",text:welcome}]);
 const [draft,setDraft] = useState("");
 const [loading,setLoading] = useState(false);
 const logEndRef = useRef<HTMLDivElement>(null);
 useEffect(()=>{ if(open) logEndRef.current?.scrollIntoView({block:"end",behavior:"smooth"}); },[messages,open]);
 useEffect(()=>{ if(!open) return; const onKey=(event:KeyboardEvent)=>{if(event.key==="Escape")setOpen(false);};window.addEventListener("keydown",onKey);return()=>window.removeEventListener("keydown",onKey);},[open]);
 const [selectedPlan,setSelectedPlan] = useState<"free"|"pro"|"premium"|null>(null);
 const lastDiscussedPlan = useRef<"free"|"pro"|"premium"|null>(null);
 const busyRef = useRef(false);
 async function ask(question: string) {
  if(busyRef.current) return;
  busyRef.current = true;
  setLoading(true);
  setMessages(previous=>[...previous.slice(-18),{role:"user",text:question}]);
  let reply = answer(question);
  try { const response = await fetch("/api/public/myka",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({question})}); if(response.ok){const data: unknown=await response.json();if(typeof data==="object"&&data!==null&&"reply" in data&&typeof data.reply==="string") reply=data.reply;} } catch { /* Commercial FAQ remains available without AI. */ }
  const q = question.toLocaleLowerCase("pt-BR");
  const wantsToProceed = /quero|seguir|come[cç]ar|continuar|cadastr|contrat|assinar|aderir|escolh|ativar|usar|fechar|comprar|migrar|trocar|pode ser|esse mesmo/.test(q);
  const explicitPlan = /premium/.test(q) ? "premium" : /\bpro\b/.test(q) ? "pro" : /\bfree\b|gr[aá]tis|gratuito/.test(q) ? "free" : null;
  const contextFollowup = /\b(esse|este|isso|nele|nesse|continuar|seguir|contratar|assinar)\b/.test(q);
  const plan = explicitPlan ?? (wantsToProceed && contextFollowup ? lastDiscussedPlan.current : null);
  if(explicitPlan) lastDiscussedPlan.current = explicitPlan;
  setSelectedPlan(null);
  if(wantsToProceed && plan) {
    setSelectedPlan(plan);
    reply = plan === "free" ? "Perfeito! O Free é gratuito. Vamos criar sua conta, sem pagamento." : `Ótima escolha! O plano ${plan === "pro" ? "Pro" : "Premium"} ainda está em homologação e não pode ser contratado agora. Você pode criar sua conta gratuita para começar a usar a MYRYRA, sem cobrança ou ativação automática do plano pago.`;
  } else if(plan === "free") {
    setSelectedPlan("free");
    reply += " Se quiser começar agora, toque em Criar minha conta grátis.";
  } else if(wantsToProceed && /plano|assinatura/.test(q)) {
    reply = "Qual plano você prefere: Free, Pro ou Premium? Posso encaminhar você ao cadastro gratuito; os planos pagos ainda não estão disponíveis para contratação.";
    setSelectedPlan(null);
  }
  setMessages(previous=>[...previous.slice(-19),{role:"assistant",text:reply}]);
  setLoading(false);
  busyRef.current = false;
 }
 function send(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  const question = draft.trim().slice(0,500);
  if (!question) return;
  void ask(question);
  setDraft("");
 }
 return <div className="fixed bottom-4 right-4 z-50 sm:bottom-6 sm:right-6">
  {open && <div aria-hidden="true" className="fixed inset-0 bg-[#070716]/95 backdrop-blur-lg" /> }
  {open && <section id="myka-floating-chat" aria-label="Converse com a MIKA" className="fixed inset-x-4 top-1/2 flex h-[min(560px,calc(100dvh-120px))] -translate-y-1/2 flex-col overflow-hidden rounded-2xl sm:left-1/2 sm:right-auto sm:w-[min(440px,calc(100vw-2rem))] sm:-translate-x-1/2 border border-violet-400/35 bg-[#100d22] p-4 text-left text-sm text-slate-100 shadow-2xl shadow-violet-950/60">
  <div className="mb-3 flex items-center justify-between gap-2"><div><p className="font-semibold text-violet-200">MIKA 💜</p><p className="text-xs text-slate-400">Informações sobre planos e recursos</p></div><button type="button" onClick={()=>setOpen(false)} aria-label="Fechar ajuda MYKA" title="Fechar ajuda MYKA" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-violet-400/40 bg-violet-500/15 text-xl text-violet-100 transition hover:bg-violet-500/30 focus-visible:outline-2 focus-visible:outline-violet-400">×</button></div>
  <div role="log" aria-live="polite" aria-relevant="additions text" className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-xl bg-slate-950/60 p-3">
   {messages.map((message,index)=><p key={index} className={message.role==="user" ? "ml-6 rounded-xl bg-violet-700/50 p-3 text-white" : "mr-4 rounded-xl bg-white/5 p-3 text-slate-100"}>{message.text}</p>)}
   <div ref={logEndRef} aria-hidden="true" />
  </div>
  {selectedPlan && <button type="button" onClick={()=>{setOpen(false);onStartFree();}} className="mt-3 w-full rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-3 font-semibold text-white">{selectedPlan === "free" ? "Criar minha conta grátis" : "Começar com conta gratuita"}</button>}
  <form onSubmit={send} className="mt-3 flex gap-2"><input aria-label="Sua pergunta para a MIKA" maxLength={500} value={draft} onChange={event=>setDraft(event.target.value)} placeholder="Pergunte à MIKA..." className="min-w-0 flex-1 rounded-xl border border-violet-400/30 bg-slate-900 px-3 py-2.5 text-white outline-none placeholder:text-slate-400 focus:border-violet-400"/><button type="submit" disabled={!draft.trim() || loading} className="rounded-xl bg-violet-600 px-4 py-2 font-semibold text-white hover:bg-violet-500 disabled:opacity-50">{loading ? "..." : "Enviar"}</button></form>
  <div className="mt-3 flex shrink-0 flex-wrap gap-2">{["Quais os planos?","Como funciona o Pro?","Posso pagar com Pix?"].map(question=><button key={question} type="button" onClick={()=>void ask(question)} className="rounded-full border border-violet-400/30 px-3 py-1 text-xs text-violet-200 hover:bg-violet-600/20">{question}</button>)}</div>
  <Link href="/planos" className="mt-3 inline-block text-xs font-medium text-violet-300 underline underline-offset-2">Ver todos os planos</Link>
  <p className="mt-2 text-[11px] text-slate-400">Respostas comerciais com fallback pré-configurado. Valores indicativos, sem cobrança. Não informe senhas ou dados de cartão.</p>
 </section>}
  <div className="flex justify-end"><button type="button" aria-expanded={open} aria-controls="myka-floating-chat" onClick={()=>setOpen(value=>!value)} className="rounded-full border border-violet-300/40 bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-900/50 transition hover:scale-[1.03] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400">{open ? "× Fechar MIKA" : "✦ Ajuda MIKA"}</button></div>
 </div>;
}
