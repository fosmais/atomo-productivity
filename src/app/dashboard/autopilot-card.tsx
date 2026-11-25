"use client";
import {useState} from "react";
type Suggestion={id:string;title:string;start:number;end:number;requiresApproval:true;estimated:boolean};
export default function AutopilotCard(){
 const [items,setItems]=useState<Suggestion[]|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState("");
 const [selected,setSelected]=useState<string[]>([]);
 const [googleConnected,setGoogleConnected]=useState(false);
 const [timeZone,setTimeZone]=useState<string|undefined>(undefined);
 async function organize(){
  setLoading(true);setError("");setItems(null);setSelected([]);
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
   setItems(data.autopilot.suggestions);
  }catch(e){setError(e instanceof Error?e.message:"Não foi possível organizar o dia.");}finally{setLoading(false);}
 }
 const format=(n:number)=>new Date(n).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit",timeZone});
 return <section className="rounded-xl border border-violet-500/30 bg-slate-950 p-4" aria-label="MIKA AutoPilot">
  <h4 className="font-semibold text-violet-200">MIKA AutoPilot</h4>
  <p className="mt-1 text-sm text-slate-300">Encontre horários livres para tarefas sem prazo, conforme suas preferências e compromissos MYRYRA. Usamos a duração cadastrada ou uma estimativa de 25 minutos quando indisponível.</p>
  <button type="button" disabled={loading} onClick={()=>void organize()} className="mt-3 rounded-lg bg-violet-700 px-3 py-2 text-sm text-white disabled:opacity-50">{loading?"Organizando...":"Organizar meu dia"}</button>
  {error&&<p role="alert" className="mt-2 text-sm text-rose-300">{error}</p>}
  {items&&<div aria-live="polite" className="mt-3 space-y-2"><p className="text-xs text-slate-400">Fuso de planejamento: {timeZone}</p>{items.length===0?<p className="text-sm text-slate-400">Nenhuma sugestão disponível para hoje.</p>:items.map(a=><div key={a.id} className="rounded-lg bg-slate-800 p-2 text-sm"><p>{a.title}</p><p className="text-slate-300">{format(a.start)} – {format(a.end)} · {Math.round((a.end-a.start)/60000)} min{a.estimated?" estimados":""}</p><label className="mt-2 flex items-center gap-2"><input type="checkbox" checked={selected.includes(a.id)} onChange={e=>setSelected(prev=>e.target.checked?[...new Set([...prev,a.id])]:prev.filter(id=>id!==a.id))}/> Selecionar para aprovação</label></div>)}{items.length>0&&<div className="flex flex-wrap gap-2"><button type="button" className="rounded border border-violet-500 px-2 py-1 text-sm" onClick={()=>setSelected(items.map(a=>a.id))}>Selecionar todas</button><button type="button" className="rounded border border-slate-500 px-2 py-1 text-sm" onClick={()=>setSelected([])}>Limpar seleção</button><p className="w-full text-xs text-slate-400">{selected.length} selecionadas. Seleção local, ainda sem autorização ou execução.</p></div>}</div>}
  <p className="mt-3 text-xs text-slate-400">Somente sugestões. Nenhum compromisso será criado ou alterado. {items&&(googleConnected?" Google Calendar considerado.":" Google Calendar não conectado; somente agenda MYRYRA considerada.")}</p>
 </section>;
}
