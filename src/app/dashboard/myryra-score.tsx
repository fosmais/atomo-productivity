"use client";
import { useState } from "react";
import { getCompletionRate, type VyraMetrics } from "./vyra-metrics";
export default function MyryraScore({metrics,loading}:{metrics:VyraMetrics|null;loading:boolean}) {
 const [notice,setNotice]=useState("");
 const score=metrics && metrics.total>0 ? getCompletionRate(metrics) : null;
 async function share(){
  if(score===null)return;
  try {
   const canvas=document.createElement("canvas");canvas.width=1080;canvas.height=1350;
   const ctx=canvas.getContext("2d");if(!ctx)throw new Error("Canvas indisponível");
   const bg=ctx.createLinearGradient(0,0,1080,1350);bg.addColorStop(0,"#38125c");bg.addColorStop(1,"#0b1021");
   ctx.fillStyle=bg;ctx.fillRect(0,0,1080,1350);
   ctx.textAlign="center";ctx.fillStyle="#c4b5fd";ctx.font="bold 48px Arial";ctx.fillText("MYRYRA",540,160);
   ctx.font="30px Arial";ctx.fillText("YOUR LIFE. IN SYNC.",540,220);
   ctx.strokeStyle="#a78bfa";ctx.lineWidth=25;ctx.beginPath();ctx.arc(540,620,230,-Math.PI/2,-Math.PI/2+2*Math.PI*score/100);ctx.stroke();
   ctx.fillStyle="#ffffff";ctx.font="bold 220px Arial";ctx.fillText(String(score),540,695);
   ctx.fillStyle="#c4b5fd";ctx.font="44px Arial";ctx.fillText("MYRYRA SCORE",540,810);
   ctx.fillStyle="#ffffff";ctx.font="38px Arial";ctx.fillText("Minha evolução em tarefas",540,1010);
   ctx.fillStyle="#a5a0b8";ctx.font="27px Arial";ctx.fillText("Compartilhado voluntariamente",540,1240);
   const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,"image/png"));
   if(!blob)throw new Error("Imagem indisponível");
   const file=new File([blob],"myryra-score.png",{type:"image/png"});
   if(navigator.share && navigator.canShare?.({files:[file]})){
    await navigator.share({title:"MYRYRA Score",files:[file]});
   }else{
    const url=URL.createObjectURL(blob);const link=document.createElement("a");link.href=url;link.download=file.name;link.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    setNotice("Card salvo em PNG. Compartilhe no aplicativo de sua preferência.");
   }
  }catch(e){if(!(e instanceof Error && e.name==="AbortError"))setNotice("Não foi possível gerar ou compartilhar o card.");}
 }
 return <section aria-label="MYRYRA Score" className="rounded-3xl border border-violet-400/30 bg-gradient-to-br from-violet-950 via-slate-950 to-slate-900 p-6 text-white">
  <p className="text-xs font-bold uppercase tracking-widest text-violet-300">MYRYRA SCORE · BETA</p>
  <h2 className="mt-2 text-xl font-semibold">Sua evolução, em números.</h2>
  <div className="mt-5 flex flex-wrap items-center justify-between gap-5">
   <div className="flex items-center gap-4">
    <div className="grid h-28 w-28 place-items-center rounded-full border-8 border-violet-500 bg-slate-950 text-center"><div><strong className="block text-4xl">{loading?"…":score??"—"}</strong><span className="text-xs text-violet-200">de 100</span></div></div>
    <div><p className="text-sm font-semibold text-violet-200">Conclusão de tarefas</p><p className="mt-1 text-sm text-slate-300">{metrics?metrics.completed+" de "+metrics.total+" concluídas":"Sem dados suficientes"}</p></div>
   </div>
   <button type="button" onClick={()=>void share()} disabled={score===null||loading} className="rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold hover:bg-violet-500 disabled:opacity-40">Compartilhar card ↗</button>
  </div>
  {notice&&<p role="status" className="mt-3 text-xs text-violet-200">{notice}</p>}
  <p className="mt-4 border-t border-white/10 pt-3 text-xs text-slate-400">Versão inicial: percentual de tarefas concluídas, não um indicador geral de bem-estar. O card não inclui tarefas nem dados pessoais.</p>
 </section>;
}
