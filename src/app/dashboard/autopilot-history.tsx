"use client";
import {useCallback,useEffect,useState} from "react";
type Entry={id:string;approval_id:string|null;action:"approval_recorded"|"execution_completed";event_ids:string[];metadata:Record<string,unknown>;created_at:string};
export default function AutopilotHistory(){
 const [items,setItems]=useState<Entry[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState("");
 const load=useCallback(async()=>{
  setLoading(true);setError("");
  try{
   const response=await fetch("/api/mika/autopilot/history?limit=50",{cache:"no-store"});
   const body=await response.json();
   if(!response.ok||!Array.isArray(body.items))throw new Error(body.error||"Não foi possível carregar o histórico.");
   setItems(body.items);
  }catch(e){setError(e instanceof Error?e.message:"Falha ao carregar histórico.");}
  finally{setLoading(false);}
 },[]);
 useEffect(()=>{
  let active=true;
  fetch("/api/mika/autopilot/history?limit=50",{cache:"no-store"})
   .then(async response=>{const body=await response.json();if(!response.ok||!Array.isArray(body.items))throw new Error(body.error||"Não foi possível carregar o histórico.");return body.items as Entry[];})
   .then(data=>{if(active)setItems(data);})
   .catch(e=>{if(active)setError(e instanceof Error?e.message:"Falha ao carregar histórico.");})
   .finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[]);
 const date=(value:string)=>new Intl.DateTimeFormat("pt-BR",{dateStyle:"short",timeStyle:"short"}).format(new Date(value));
 return <section className="rounded-xl border border-white/10 bg-slate-950/60 p-4" aria-label="Histórico do MIKA AutoPilot">
  <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-semibold text-white">Histórico do AutoPilot</h3><p className="mt-1 text-sm text-slate-400">Acompanhe autorizações e compromissos criados pela MIKA.</p></div><button type="button" onClick={()=>void load()} disabled={loading} className="rounded-lg border border-violet-400/40 px-3 py-2 text-sm text-violet-200 disabled:opacity-50">{loading?"Atualizando...":"Atualizar"}</button></div>
  {error&&<p role="alert" className="mt-3 text-sm text-rose-300">{error}</p>}
  {loading&&!items.length?<p className="mt-3 text-sm text-slate-400">Carregando histórico...</p>:!items.length?<p className="mt-3 text-sm text-slate-400">Nenhuma atividade registrada até o momento.</p>:<ol className="mt-4 space-y-3">{items.map(item=><li key={item.id} className="rounded-lg border border-white/10 bg-slate-900 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-sm text-violet-200">{item.action==="approval_recorded"?"Autorização registrada":"Compromissos criados"}</strong><time className="text-xs text-slate-400" dateTime={item.created_at}>{date(item.created_at)}</time></div><p className="mt-1 text-xs text-slate-300">ID da autorização: {item.approval_id??"—"}</p>{item.action==="approval_recorded"?<p className="mt-1 text-xs text-slate-400">{typeof item.metadata.slot_count==="number"?item.metadata.slot_count:0} sugestão(ões) autorizada(s)</p>:<p className="mt-1 text-xs text-slate-400">{item.event_ids?.length??0} compromisso(s) criado(s)</p>}{item.event_ids?.length>0&&<p className="mt-1 break-all text-xs text-slate-500">IDs: {item.event_ids.join(", ")}</p>}</li>)}</ol>}
 </section>;
}
