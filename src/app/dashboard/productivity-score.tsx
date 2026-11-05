"use client";
import {useEffect,useState} from "react";
import {loadVyraMetrics} from "./vyra-metrics-service";
import {getCompletionRate,type VyraMetrics} from "./vyra-metrics";
import {useVyraActiveModule} from "./vyra-module-context";

export default function ProductivityScore(){
 const active=useVyraActiveModule();
 const [metrics,setMetrics]=useState<VyraMetrics|null>(null);
 const [message,setMessage]=useState("");
 useEffect(()=>{if(active!=="vyra-performance")return;let live=true;void loadVyraMetrics().then(value=>{if(live)setMetrics(value);}).catch(()=>{if(live)setMetrics(null);});return()=>{live=false;};},[active]);
 const score=metrics?getCompletionRate(metrics):null;
 const shareText=score===null?"":`Meu score de produtividade na MYRYRA: ${score}% de tarefas concluídas. Organize seu dia com a MIKA! https://myryra.com`;
 async function share(){if(!shareText)return;try{if(navigator.share)await navigator.share({title:"Meu score MYRYRA",text:shareText});else{await navigator.clipboard.writeText(shareText);setMessage("Score copiado! Cole na sua rede social.");}}catch(error){if(error instanceof Error&&error.name==="AbortError")return;setMessage("Não foi possível compartilhar. Use o WhatsApp.");}}
 return <section className="rounded-2xl border border-violet-400/25 bg-gradient-to-br from-violet-950/45 to-slate-950 p-4 sm:p-6" aria-label="Seu score de produtividade">
  <p className="text-xs font-semibold uppercase tracking-widest text-violet-300">MYRYRA · SUA EVOLUÇÃO</p>
  <h3 className="mt-2 text-lg font-semibold text-white">Seu score de produtividade</h3>
  <p className="mt-1 text-xs text-slate-400">Percentual de tarefas concluídas entre as cadastradas. Não é uma avaliação pessoal.</p>
  <p className="mt-4 text-3xl font-bold text-white">{score===null?"—":`${score}%`}</p>
  <div role="progressbar" aria-label="Tarefas concluídas" aria-valuemin={0} aria-valuemax={100} aria-valuenow={score??0} className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-violet-400" style={{width:`${score??0}%`}}/></div>
  <div className="mt-4 flex flex-wrap gap-2"><a href={shareText?`https://wa.me/?text=${encodeURIComponent(shareText)}`:undefined} onClick={e=>{if(!shareText)e.preventDefault();}} target="_blank" rel="noopener noreferrer" aria-disabled={!shareText} className={`rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100 ${!shareText?"pointer-events-none opacity-50":""}`}>Compartilhar no WhatsApp</a><button type="button" disabled={!shareText} onClick={()=>void share()} className="rounded-lg border border-violet-400/30 px-3 py-2 text-xs text-violet-100 disabled:opacity-50">Outras redes</button></div>
  {message&&<p role="status" className="mt-2 text-xs text-violet-200">{message}</p>}
 </section>;
}
