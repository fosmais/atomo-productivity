"use client";
import {useState} from "react";
type Suggestion={id:string;title:string;start:number;end:number;requiresApproval:true};
export default function AutopilotCard(){
 const [items,setItems]=useState<Suggestion[]|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState("");
 async function organize(){
  setLoading(true);setError("");setItems(null);
  try{
   const now=new Date(),start=new Date(now.getFullYear(),now.getMonth(),now.getDate()),end=new Date(now.getFullYear(),now.getMonth(),now.getDate()+1);
   const response=await fetch("/api/mika/daily-plan",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({dayStart:start.toISOString(),dayEnd:end.toISOString()}),cache:"no-store"});
   if(!response.ok)throw new Error("Não foi possível gerar sugestões agora.");
   const data=await response.json();
   if(!Array.isArray(data.autopilot?.suggestions))throw new Error("Sugestões indisponíveis.");
   setItems(data.autopilot.suggestions);
  }catch(e){setError(e instanceof Error?e.message:"Não foi possível organizar o dia.");}finally{setLoading(false);}
 }
 const format=(n:number)=>new Date(n).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"});
 return <section className="rounded-xl border border-violet-500/30 bg-slate-950 p-4" aria-label="MIKA AutoPilot">
  <h4 className="font-semibold text-violet-200">MIKA AutoPilot</h4>
  <p className="mt-1 text-sm text-slate-300">Encontre horários livres para tarefas sem prazo, conforme suas preferências e compromissos MYRYRA. Cada bloco tem duração estimada de 25 minutos.</p>
  <button type="button" disabled={loading} onClick={()=>void organize()} className="mt-3 rounded-lg bg-violet-700 px-3 py-2 text-sm text-white disabled:opacity-50">{loading?"Organizando...":"Organizar meu dia"}</button>
  {error&&<p role="alert" className="mt-2 text-sm text-rose-300">{error}</p>}
  {items&&<div aria-live="polite" className="mt-3 space-y-2">{items.length===0?<p className="text-sm text-slate-400">Nenhuma sugestão disponível para hoje.</p>:items.map(a=><div key={a.id} className="rounded-lg bg-slate-800 p-2 text-sm"><p>{a.title}</p><p className="text-slate-300">{format(a.start)} – {format(a.end)} · 25 min estimados</p></div>)}</div>}
  <p className="mt-3 text-xs text-slate-400">Somente sugestões. Nenhum compromisso será criado ou alterado. Calendários externos não são considerados.</p>
 </section>;
}
