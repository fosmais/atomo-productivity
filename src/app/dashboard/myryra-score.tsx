"use client";
import { useState } from "react";
import { getCompletionRate, type VyraMetrics } from "./vyra-metrics";
export default function MyryraScore({metrics,loading}:{metrics:VyraMetrics|null;loading:boolean}) {
 const [notice,setNotice]=useState("");
 const score=metrics && metrics.total>0 ? getCompletionRate(metrics) : null;
 async function share(){
  if(score===null)return;
  const message="Meu MYRYRA Score de tarefas: "+score+"/100. #MYRYRA";
  try {
   if(navigator.share){await navigator.share({title:"MYRYRA Score",text:message});}
   else if(navigator.clipboard){await navigator.clipboard.writeText(message);setNotice("Texto copiado para compartilhar.");}
   else setNotice("Compartilhamento indisponível.");
  }catch(e){if(!(e instanceof Error && e.name==="AbortError"))setNotice("Não foi possível compartilhar.");}
 }
 return <section aria-label="MYRYRA Score" className="rounded-3xl border border-violet-400/30 bg-gradient-to-br from-violet-950 via-slate-950 to-slate-900 p-6 text-white">
  <p className="text-xs font-bold uppercase tracking-widest text-violet-300">MYRYRA SCORE · BETA</p>
  <h2 className="mt-2 text-xl font-semibold">Sua evolução, em números.</h2>
  <div className="mt-5 flex flex-wrap items-center justify-between gap-5">
   <div className="flex items-center gap-4">
    <div className="grid h-28 w-28 place-items-center rounded-full border-8 border-violet-500 bg-slate-950 text-center"><div><strong className="block text-4xl">{loading?"…":score??"—"}</strong><span className="text-xs text-violet-200">de 100</span></div></div>
    <div><p className="text-sm font-semibold text-violet-200">Conclusão de tarefas</p><p className="mt-1 text-sm text-slate-300">{metrics?metrics.completed+" de "+metrics.total+" concluídas":"Sem dados suficientes"}</p></div>
   </div>
   <button type="button" onClick={()=>void share()} disabled={score===null||loading} className="rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold hover:bg-violet-500 disabled:opacity-40">Compartilhar Score ↗</button>
  </div>
  {notice&&<p role="status" className="mt-3 text-xs text-violet-200">{notice}</p>}
  <p className="mt-4 border-t border-white/10 pt-3 text-xs text-slate-400">Versão inicial: percentual de tarefas concluídas, não um indicador geral de bem-estar. O compartilhamento não inclui tarefas nem dados pessoais.</p>
 </section>;
}
