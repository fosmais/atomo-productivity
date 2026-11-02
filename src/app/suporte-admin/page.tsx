"use client";
import { useEffect, useState } from "react";
type Ticket = { id:string; subject:string; message:string; status:string; priority:string; category:string; created_at:string };
type AuditEvent = { id:string; ticket_id:string; previous_status:string|null; new_status:string|null; previous_priority:string|null; new_priority:string|null; created_at:string };
const statusOptions = [["open","Aberto"],["in_progress","Em análise"],["resolved","Resolvido"],["closed","Encerrado"]];
const priorityOptions = [["low","Baixa"],["normal","Normal"],["high","Alta"],["urgent","Urgente"]];
export default function SupportAdminPage() {
 const [tickets,setTickets] = useState<Ticket[]>([]);
 const [events,setEvents] = useState<AuditEvent[]>([]);
 const [notice,setNotice] = useState("Consultando chamados...");
 const [busy,setBusy] = useState("");
 const [refreshing,setRefreshing] = useState(false);
 const [needsLogin,setNeedsLogin] = useState(false);
 async function refresh() {
  setRefreshing(true);
  try {
   const response=await fetch("/api/support/admin",{cache:"no-store"});
   if(!response.ok){setNeedsLogin(response.status===401);const payload=await response.json().catch(()=>({error:""})) as {error?:string};setTickets([]);setEvents([]);setNotice(payload.error || (response.status===401?"Faça login na MYRYRA para acessar o suporte.":response.status===403?"Acesso restrito.":"Consulta indisponível."));return;}
   const data=await response.json() as {tickets:Ticket[];events:AuditEvent[]};
   setNeedsLogin(false);
   setTickets(data.tickets);setEvents(data.events ?? []);setNotice(data.tickets.length?"":"Nenhum chamado encontrado.");
  } catch {setNotice("Falha de conexão.");}
  finally {setRefreshing(false);}
 }
 useEffect(()=>{void refresh();},[]);
 async function update(id:string,field:"status"|"priority",value:string){
  setBusy(id);
  try{
   const response=await fetch("/api/support/admin",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,[field]:value})});
   if(!response.ok)throw new Error("Falha ao atualizar.");
   await refresh();
  }catch{setNotice("Não foi possível atualizar o chamado.");}
  finally{setBusy("");}
 }
 return <main className="mx-auto min-h-screen max-w-5xl bg-slate-950 p-6 text-white">
  <a href="/dashboard" className="text-violet-300">Voltar ao painel</a>
  <h1 className="mt-6 text-2xl font-semibold">MYRYRA · Administração de suporte</h1>
  <p className="mt-2 text-sm text-slate-400">Acesso restrito a operadores autorizados.</p>
  <button type="button" onClick={()=>void refresh()} disabled={refreshing} className="mt-5 rounded-xl border border-violet-400 px-4 py-2 disabled:opacity-50">{refreshing?"Consultando...":"Atualizar"}</button>
  {needsLogin && <div className="mt-4 space-y-2 rounded-xl border border-amber-400/30 bg-amber-400/5 p-4 text-sm"><p>A sessão não está disponível neste endereço. Atualizar não autentica novamente.</p><a className="inline-block rounded-lg bg-violet-600 px-4 py-2 font-semibold text-white" href="/login">Entrar neste ambiente</a><p className="text-slate-400">Após concluir o login e o segundo fator, abra Administração de suporte neste mesmo domínio.</p></div>}
  {notice&&<p role="status" className="mt-4 text-sm text-amber-200">{notice}</p>}
  <div className="mt-6 space-y-4">{tickets.map(ticket=><article key={ticket.id} className="rounded-xl border border-white/10 bg-slate-900 p-4">
   <h2 className="font-semibold">{ticket.subject}</h2>
   <p className="mt-1 text-xs text-slate-400">{ticket.id.slice(0,8).toUpperCase()} · {ticket.category==="billing"?"Financeiro":"Suporte"} · {new Date(ticket.created_at).toLocaleDateString("pt-BR")}</p>
   <p className="mt-3 whitespace-pre-wrap break-words text-sm">{ticket.message}</p>
   <div className="mt-4 flex flex-wrap gap-4">
    <label className="text-sm">Status <select className="ml-2 rounded bg-slate-800 p-2" disabled={busy===ticket.id} value={ticket.status} onChange={e=>void update(ticket.id,"status",e.target.value)}>{statusOptions.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
    <label className="text-sm">Prioridade <select className="ml-2 rounded bg-slate-800 p-2" disabled={busy===ticket.id} value={ticket.priority} onChange={e=>void update(ticket.id,"priority",e.target.value)}>{priorityOptions.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
   </div>
   {events.some(event=>event.ticket_id===ticket.id)&&<details className="mt-4 text-xs text-slate-300"><summary className="cursor-pointer text-violet-300">Histórico de alterações</summary><ul className="mt-2 space-y-2">{events.filter(event=>event.ticket_id===ticket.id).map(event=><li key={event.id}>{new Date(event.created_at).toLocaleString("pt-BR")} · {event.previous_status!==event.new_status?`Status: ${event.previous_status} → ${event.new_status}`:""} {event.previous_priority!==event.new_priority?`Prioridade: ${event.previous_priority} → ${event.new_priority}`:""}</li>)}</ul></details>}
  </article>)}</div>
 </main>;
}
