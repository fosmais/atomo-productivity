"use client";
import { useEffect, useState } from "react";
type Ticket = { id:string; subject:string; message:string; status:string; priority:string; category:string; created_at:string; myka_authorized?:boolean; contact?: { name:string|null; email:string|null; phone:string|null } };
type AuditEvent = { id:string; ticket_id:string; previous_status:string|null; new_status:string|null; previous_priority:string|null; new_priority:string|null; created_at:string };
type Reply = {id:string;ticket_id:string;author_type:string;body:string;created_at:string};
const statusOptions = [["open","Aberto"],["in_progress","Em análise"],["resolved","Resolvido"],["closed","Encerrado"]];
const priorityOptions = [["low","Baixa"],["normal","Normal"],["high","Alta"],["urgent","Urgente"]];
export default function SupportAdminPage() {
 const [tickets,setTickets] = useState<Ticket[]>([]);
 const [events,setEvents] = useState<AuditEvent[]>([]);
 const [replies,setReplies] = useState<Reply[]>([]);
 const [drafts,setDrafts] = useState<Record<string,string>>({});
 const [notice,setNotice] = useState("Consultando chamados...");
 const [busy,setBusy] = useState("");
 const [refreshing,setRefreshing] = useState(false);
 const [needsLogin,setNeedsLogin] = useState(false);
 async function refresh() {
  setRefreshing(true);
  try {
   const response=await fetch("/api/support/admin",{cache:"no-store"});
   if(!response.ok){setNeedsLogin(response.status===401);const payload=await response.json().catch(()=>({error:""})) as {error?:string};setTickets([]);setEvents([]);setReplies([]);setNotice(payload.error || (response.status===401?"Faça login na MYRYRA para acessar o suporte.":response.status===403?"Acesso restrito.":"Consulta indisponível."));return;}
   const data=await response.json() as {tickets:Ticket[];events:AuditEvent[];replies:Reply[]};
   setNeedsLogin(false);
   setTickets(data.tickets);setEvents(data.events ?? []);setReplies(data.replies ?? []);setNotice(data.tickets.length?"":"Nenhum chamado encontrado.");
  } catch {setNotice("Falha de conexão.");}
  finally {setRefreshing(false);}
 }
 useEffect(()=>{
  let active = true;
  queueMicrotask(() => { if (active) void refresh(); });
  return () => { active = false; };
 },[]);
 async function update(id:string,field:"status"|"priority",value:string){
  setBusy(id);
  try{
   const response=await fetch("/api/support/admin",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,[field]:value})});
   if(!response.ok)throw new Error("Falha ao atualizar.");
   await refresh();
  }catch{setNotice("Não foi possível atualizar o chamado.");}
  finally{setBusy("");}
 }
 async function mykaAction(id:string, action:{authorized:boolean}|{reply:string}) {
  setBusy(id);
  try {
   const response=await fetch("/api/support/admin/myka",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,...action})});
   const result=await response.json() as {error?:string};
   if(!response.ok) throw new Error(result.error || "Falha na operação.");
   if("reply" in action) setDrafts(previous=>({...previous,[id]:""}));
   await refresh();
  } catch(error) {setNotice(error instanceof Error?error.message:"Operação indisponível.");}
  finally {setBusy("");}
 }
 return <main className="mx-auto min-h-screen max-w-5xl bg-slate-950 p-6 text-white">
  <a href="/dashboard" className="text-violet-300">Voltar ao painel</a>
  <h1 className="mt-6 text-2xl font-semibold">MYRYRA · Administração de suporte</h1>
  <p className="mt-2 text-sm text-slate-400">Acesso restrito a operadores autorizados.</p>
  <button type="button" onClick={()=>void refresh()} disabled={refreshing} className="mt-5 rounded-xl border border-violet-400 px-4 py-2 disabled:opacity-50">{refreshing?"Consultando...":"Atualizar"}</button>
  {needsLogin && <div className="mt-4 space-y-2 rounded-xl border border-amber-400/30 bg-amber-400/5 p-4 text-sm"><p>A sessão não está disponível neste endereço. Atualizar não autentica novamente.</p><a className="inline-block rounded-lg bg-violet-600 px-4 py-2 font-semibold text-white" href="/login?next=%2Fsuporte-admin">Entrar neste ambiente</a><p className="text-slate-400">Após concluir o login e o segundo fator, abra Administração de suporte neste mesmo domínio.</p></div>}
  {notice&&<p role="status" className="mt-4 text-sm text-amber-200">{notice}</p>}
  <div className="mt-6 space-y-4">{tickets.map(ticket=><article key={ticket.id} className="rounded-xl border border-white/10 bg-slate-900 p-4">
   <h2 className="font-semibold">{ticket.subject}</h2>
   <p className="mt-1 text-xs text-slate-400">{ticket.id.slice(0,8).toUpperCase()} · {ticket.category==="billing"?"Financeiro":"Suporte"} · {new Date(ticket.created_at).toLocaleDateString("pt-BR")}</p>
   <div className="mt-3 rounded-lg border border-white/10 bg-slate-950/60 p-3 text-sm">
    <p className="font-semibold text-violet-200">Solicitante</p>
    <p className="mt-1">{ticket.contact?.name || "Nome não informado"}</p>
    <div className="mt-1 flex flex-wrap items-center gap-2"><span className="break-all text-slate-300">{ticket.contact?.email || "E-mail não disponível"}</span>{ticket.contact?.email && <button type="button" className="rounded border border-violet-400/40 px-2 py-1 text-xs text-violet-200" onClick={() => void navigator.clipboard.writeText(ticket.contact!.email!)}>Copiar e-mail</button>}</div>
    <p className="mt-1 text-slate-300">Telefone: {ticket.contact?.phone || "Não informado"}</p>
   </div>
   <p className="mt-3 whitespace-pre-wrap break-words text-sm">{ticket.message}</p>
   <div className="mt-4 flex flex-wrap gap-4">
    <label className="text-sm">Status <select className="ml-2 rounded bg-slate-800 p-2" disabled={busy===ticket.id} value={ticket.status} onChange={e=>void update(ticket.id,"status",e.target.value)}>{statusOptions.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
    <label className="text-sm">Prioridade <select className="ml-2 rounded bg-slate-800 p-2" disabled={busy===ticket.id} value={ticket.priority} onChange={e=>void update(ticket.id,"priority",e.target.value)}>{priorityOptions.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
   </div>
   <section className="mt-4 space-y-3 rounded-xl border border-violet-400/30 bg-violet-950/20 p-3">
    <div className="flex items-center gap-3"><img src="/myka-transparente.png" alt="MYKA" className="h-10 w-10 object-contain"/><div><p className="font-semibold">MYKA · Respostas supervisionadas</p><p className="text-xs text-slate-300">A MYKA não envia mensagens sem sua aprovação.</p></div></div>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(ticket.myka_authorized)} disabled={busy===ticket.id} onChange={e=>void mykaAction(ticket.id,{authorized:e.target.checked})}/> Autorizar MYKA neste chamado</label>
    {ticket.myka_authorized && <><button type="button" disabled={busy===ticket.id} onClick={()=>setDrafts(previous=>({...previous,[ticket.id]:`Olá! Recebemos seu chamado sobre ${ticket.subject.toLowerCase()}. Estamos analisando sua solicitação e retornaremos com orientações assim que possível. Atenciosamente, equipe MYRYRA.`}))} className="rounded-lg border border-violet-400 px-3 py-2 text-xs text-violet-200">Preparar modelo de resposta</button><p className="text-xs text-slate-400">Modelo inicial editável, ainda não gerado por IA. Revise antes de enviar.</p><textarea aria-label="Resposta para aprovação" className="min-h-24 w-full rounded-lg bg-slate-900 p-3 text-sm" maxLength={3000} value={drafts[ticket.id]||""} onChange={e=>setDrafts(previous=>({...previous,[ticket.id]:e.target.value}))}/><button type="button" disabled={busy===ticket.id || !(drafts[ticket.id]||"").trim()} onClick={()=>void mykaAction(ticket.id,{reply:drafts[ticket.id]})} className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold disabled:opacity-40">Aprovar e registrar resposta</button></>}
    {replies.filter(reply=>reply.ticket_id===ticket.id).map(reply=><div key={reply.id} className="rounded-lg bg-slate-900 p-3 text-sm"><p className="mb-1 text-xs text-violet-300">Resposta aprovada · {new Date(reply.created_at).toLocaleString("pt-BR")}</p><p className="whitespace-pre-wrap">{reply.body}</p></div>)}
   </section>
   {events.some(event=>event.ticket_id===ticket.id)&&<details className="mt-4 text-xs text-slate-300"><summary className="cursor-pointer text-violet-300">Histórico de alterações</summary><ul className="mt-2 space-y-2">{events.filter(event=>event.ticket_id===ticket.id).map(event=><li key={event.id}>{new Date(event.created_at).toLocaleString("pt-BR")} · {event.previous_status!==event.new_status?`Status: ${event.previous_status} → ${event.new_status}`:""} {event.previous_priority!==event.new_priority?`Prioridade: ${event.previous_priority} → ${event.new_priority}`:""}</li>)}</ul></details>}
  </article>)}</div>
 </main>;
}
