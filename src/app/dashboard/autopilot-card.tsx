"use client";
import {useState} from "react";
type Suggestion={id:string;title:string;start:number;end:number;requiresApproval:true;estimated:boolean};
export default function AutopilotCard(){
 const [items,setItems]=useState<Suggestion[]|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState("");
 const [approvalToken,setApprovalToken]=useState<string|null>(null);
 const [validating,setValidating]=useState(false);
 const [persisted,setPersisted]=useState(false);
 const [approvalId,setApprovalId]=useState<string|null>(null);
 const [executing,setExecuting]=useState(false);
 const [cancelling,setCancelling]=useState(false);
 const [validation,setValidation]=useState("");
 const [selected,setSelected]=useState<string[]>([]);
 const [googleConnected,setGoogleConnected]=useState(false);
 const [timeZone,setTimeZone]=useState<string|undefined>(undefined);
 async function organize(){
  setLoading(true);setError("");setItems(null);setSelected([]);setApprovalToken(null);setValidation("");setPersisted(false);setApprovalId(null);
  try{
   const response=await fetch("/api/mika/daily-plan",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({configuredToday:true}),cache:"no-store"});
   if(!response.ok){const failure=await response.json().catch(()=>null);throw new Error(failure?.code==="EXTERNAL_AVAILABILITY_UNAVAILABLE"?"Não foi possível confirmar a disponibilidade do Google Calendar. Tente novamente ou revise sua conexão.":"Não foi possível gerar sugestões agora.");}
   const data=await response.json();
   if(!Array.isArray(data.autopilot?.suggestions))throw new Error("Sugestões indisponíveis.");
   const zone=data.autopilot.timeZone;
   if(typeof zone!=="string")throw new Error("Fuso de planejamento indisponível.");
   new Intl.DateTimeFormat("pt-BR",{timeZone:zone});
   setTimeZone(zone);
   setGoogleConnected(data.autopilot.googleCalendarConnected===true);
   setApprovalToken(typeof data.autopilot.approvalToken==="string"?data.autopilot.approvalToken:null);
   setItems(data.autopilot.suggestions);
  }catch(e){setError(e instanceof Error?e.message:"Não foi possível organizar o dia.");}finally{setLoading(false);}
 }
 async function validateSelection(){
  if(!approvalToken||!selected.length||validating)return;
  setValidating(true);setValidation("");setError("");
  try{
   const response=await fetch("/api/mika/autopilot/approve",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({approvalToken,approvedIds:selected}),cache:"no-store"});
   const result=await response.json();
   if(!response.ok||result.validated!==true||typeof result.persisted!=="boolean"||result.executed!==false)throw new Error("Não foi possível validar a seleção. Gere novas sugestões.");
   if(result.persisted){
    if(typeof result.approvalId!=="string"||!result.approvalId)throw new Error("Registro não confirmado. Consulte o histórico antes de tentar novamente.");
    setPersisted(true);setApprovalId(result.approvalId);setApprovalToken(null);
    setValidation("Autorização registrada. Nenhuma ação foi executada.");
   }else setValidation("Seleção validada. Nenhuma autorização foi gravada e nenhuma ação foi executada.");
  }catch(e){setError(e instanceof Error?e.message:"Falha na validação.");}finally{setValidating(false);}
 }
 async function executeApproval(){
  if(!approvalId||executing||cancelling)return;
  setExecuting(true);setError("");setValidation("");
  try{
   const response=await fetch("/api/mika/autopilot/execute",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({approvalId}),cache:"no-store"});
   const result=await response.json();
   if(!response.ok||result.executed!==true||!Array.isArray(result.eventIds))throw new Error(result.error||"Não foi possível executar a autorização.");
   setValidation(result.idempotent?"Esta autorização já havia sido executada.":"Compromissos criados na sua agenda MYRYRA.");
   setApprovalId(null);
  }catch(e){setError(e instanceof Error?e.message:"Falha na execução.");}finally{setExecuting(false);}
 }
 async function cancelApproval(){
  if(!approvalId||executing||cancelling)return;
  setCancelling(true);setError("");
  try{
   const response=await fetch("/api/mika/autopilot/cancel",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({approvalId}),cache:"no-store"});
   const result=await response.json();
   if(!response.ok||result.cancelled!==true)throw new Error(result.error||"Não foi possível cancelar.");
   setApprovalId(null);setPersisted(false);setItems(null);setSelected([]);setValidation("Autorização cancelada. Gere novas sugestões.");
  }catch(e){setError(e instanceof Error?e.message:"Falha no cancelamento.");}finally{setCancelling(false);}
 }
 const format=(n:number)=>new Date(n).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit",timeZone});
 return <section className="rounded-xl border border-violet-500/30 bg-slate-950 p-4" aria-label="MIKA AutoPilot">
  <h4 className="font-semibold text-violet-200">MIKA AutoPilot</h4>
  <p className="mt-1 text-sm text-slate-300">Encontre horários livres para tarefas sem prazo, conforme suas preferências e compromissos MYRYRA. Usamos a duração cadastrada ou uma estimativa de 25 minutos quando indisponível.</p>
  <button type="button" disabled={loading||validating||executing||cancelling||!!approvalId} onClick={()=>void organize()} className="mt-3 rounded-lg bg-violet-700 px-3 py-2 text-sm text-white disabled:opacity-50">{loading?"Organizando...":"Organizar meu dia"}</button>
  {error&&<p role="alert" className="mt-2 text-sm text-rose-300">{error}</p>}
  {items&&<div aria-live="polite" className="mt-3 space-y-2"><p className="text-xs text-slate-400">Fuso de planejamento: {timeZone}</p>{items.length===0?<p className="text-sm text-slate-400">Nenhuma sugestão disponível para hoje.</p>:items.map(a=><div key={a.id} className="rounded-lg bg-slate-800 p-2 text-sm"><p>{a.title}</p><p className="text-slate-300">{format(a.start)} – {format(a.end)} · {Math.round((a.end-a.start)/60000)} min{a.estimated?" estimados":""}</p><label className="mt-2 flex items-center gap-2"><input type="checkbox" disabled={validating||persisted} checked={selected.includes(a.id)} onChange={e=>{setValidation("");setSelected(prev=>e.target.checked?[...new Set([...prev,a.id])]:prev.filter(id=>id!==a.id))}}/> Selecionar para aprovação</label></div>)}{items.length>0&&<div className="flex flex-wrap gap-2"><button type="button" className="rounded border border-violet-500 px-2 py-1 text-sm" disabled={validating||persisted} onClick={()=>{setValidation("");setSelected(items.map(a=>a.id))}}>Selecionar todas</button><button type="button" className="rounded border border-slate-500 px-2 py-1 text-sm" disabled={validating||persisted} onClick={()=>{setValidation("");setSelected([])}}>Limpar seleção</button><p className="w-full text-xs text-slate-400">{selected.length} selecionadas. {persisted?"Autorização registrada.":"Ao confirmar, sua autorização poderá ser registrada. Nenhuma ação será executada."}</p><button type="button" disabled={!approvalToken||!selected.length||validating} onClick={()=>void validateSelection()} className="rounded bg-violet-700 px-3 py-2 text-sm text-white disabled:opacity-50">{validating?"Validando...":"Confirmar seleção"}</button>{!approvalToken&&!persisted&&<p className="text-xs text-slate-400">Validação indisponível neste ambiente.</p>}{validation&&<p role="status" className="text-xs text-slate-300">{validation}</p>}{persisted&&approvalId&&<button type="button" disabled={executing||cancelling} onClick={()=>void executeApproval()} className="rounded bg-emerald-700 px-3 py-2 text-sm text-white disabled:opacity-50">{executing?"Executando...":"Executar compromissos aprovados"}</button>}{persisted&&approvalId&&<button type="button" disabled={executing||cancelling} onClick={()=>void cancelApproval()} className="rounded border border-slate-500 px-3 py-2 text-sm text-white disabled:opacity-50">{cancelling?"Cancelando...":"Cancelar autorização"}</button>}</div>}</div>}
  {!items&&validation&&<p role="status" className="mt-2 text-sm text-slate-300">{validation}</p>}
  <p className="mt-3 text-xs text-slate-400">Sugestões exigem sua aprovação. A execução cria compromissos na agenda MYRYRA; o Google Calendar permanece somente leitura. {items&&(googleConnected?" Google Calendar considerado.":" Google Calendar não conectado; somente agenda MYRYRA considerada.")}</p>
 </section>;
}
