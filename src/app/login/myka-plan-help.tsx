"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { BILLING_PLANS } from "@/lib/billing/plans";

type Message = { role: "user" | "assistant"; text: string };
const welcome = "Olá! Sou a MYKA 💜 Pergunte sobre os planos, recursos, preços ou pagamentos da MYRYRA. Nesta versão, respondo às dúvidas comerciais mais frequentes.";
function answer(question: string): string {
 const q = question.toLocaleLowerCase("pt-BR");
 if (/cart[aã]o|pix|pagamento|cobran|assinar|checkout|comprar/.test(q)) return "As assinaturas e cobranças ainda não estão disponíveis. O checkout está em preparação; não informe dados de cartão nesta conversa.";
 if (/premium/.test(q)) return "O Premium está previsto por R$ 49,90/mês, com 250 interações de IA por dia, recursos Pro, insights avançados e metas pessoais. Valores e recursos ainda estão em homologação.";
 if (/pro/.test(q)) return "O Pro está previsto por R$ 29,90/mês, com 100 interações de IA por dia, Smart Calendar, What Now?, Daily Briefing, AutoPilot e Weekly Intelligence. Ainda não está disponível para contratação.";
 if (/gr[aá]tis|gratuito|free/.test(q)) return "O Free está previsto como gratuito, com 10 interações de IA por dia, agenda, tarefas, calendário básico e What Now? básico.";
 if (/pre[cç]o|valor|quanto|plano|diferen|limite/.test(q)) return "Planos previstos: Free (R$ 0), Pro (R$ 29,90/mês) e Premium (R$ 49,90/mês). Os limites indicativos são 10, 100 e 250 interações de IA por dia, respectivamente. Nada está sendo cobrado nesta versão.";
 if (/agenda|calend[aá]rio|smart|autopilot|what now|recurso|funciona/.test(q)) return "A MYRYRA organiza agenda e tarefas e prevê ferramentas de planejamento com IA. Smart Calendar, AutoPilot e análises avançadas aparecem nos planos superiores; a disponibilidade está em homologação.";
 return "Posso ajudar com preços, diferenças entre Free, Pro e Premium, recursos e formas de pagamento. Para outras perguntas sobre sua rotina, entre na MYRYRA e converse com a MYKA completa.";
}
export default function MykaPlanHelp() {
 const [messages, setMessages] = useState<Message[]>([{role:"assistant",text:welcome}]);
 const [draft,setDraft] = useState("");
 const [loading,setLoading] = useState(false);
 async function ask(question: string) {
  if(loading) return;
  setLoading(true);
  setMessages(previous=>[...previous.slice(-18),{role:"user",text:question}]);
  let reply = answer(question);
  try { const response = await fetch("/api/public/myka",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({question})}); if(response.ok){const data: unknown=await response.json();if(typeof data==="object"&&data!==null&&"reply" in data&&typeof data.reply==="string") reply=data.reply;} } catch { /* Commercial FAQ remains available without AI. */ }
  setMessages(previous=>[...previous.slice(-19),{role:"assistant",text:reply}]);
  setLoading(false);
 }
 function send(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  const question = draft.trim().slice(0,500);
  if (!question) return;
  void ask(question);
  setDraft("");
 }
 return <section aria-label="Converse com a MYKA" className="relative z-10 mt-4 w-full max-w-md rounded-2xl border border-violet-400/35 bg-[#100d22]/95 p-4 text-left text-sm text-slate-100 shadow-xl">
  <div className="mb-3 flex items-center justify-between gap-2"><div><p className="font-semibold text-violet-200">MYKA 💜</p><p className="text-xs text-slate-400">Assistente de planos • disponível para perguntas</p></div><span className="rounded-full bg-violet-500/20 px-2 py-1 text-xs text-violet-200">Aberto</span></div>
  <div role="log" aria-live="polite" aria-relevant="additions text" className="max-h-56 min-h-32 space-y-3 overflow-y-auto rounded-xl bg-slate-950/60 p-3">
   {messages.map((message,index)=><p key={index} className={message.role==="user" ? "ml-6 rounded-xl bg-violet-700/50 p-3 text-white" : "mr-4 rounded-xl bg-white/5 p-3 text-slate-100"}>{message.text}</p>)}
  </div>
  <form onSubmit={send} className="mt-3 flex gap-2"><input aria-label="Sua pergunta para a MYKA" maxLength={500} value={draft} onChange={event=>setDraft(event.target.value)} placeholder="Pergunte à MYKA..." className="min-w-0 flex-1 rounded-xl border border-violet-400/30 bg-slate-900 px-3 py-2.5 text-white outline-none placeholder:text-slate-400 focus:border-violet-400"/><button type="submit" disabled={!draft.trim() || loading} className="rounded-xl bg-violet-600 px-4 py-2 font-semibold text-white hover:bg-violet-500 disabled:opacity-50">{loading ? "..." : "Enviar"}</button></form>
  <div className="mt-3 flex flex-wrap gap-2">{["Quais os planos?","Como funciona o Pro?","Posso pagar com Pix?"].map(question=><button key={question} type="button" onClick={()=>void ask(question)} className="rounded-full border border-violet-400/30 px-3 py-1 text-xs text-violet-200 hover:bg-violet-600/20">{question}</button>)}</div>
  <Link href="/planos" className="mt-3 inline-block text-xs font-medium text-violet-300 underline underline-offset-2">Ver todos os planos</Link>
  <p className="mt-2 text-xs text-slate-400">Respostas comerciais com fallback pré-configurado. Valores indicativos, sem cobrança. Não informe senhas ou dados de cartão.</p>
 </section>;
}
