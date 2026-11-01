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
   ctx.fillStyle="#c4b5fd";ctx.font="30px Arial";ctx.fillText(String(metrics?.completed??0)+" de "+String(metrics?.total??0)+" tarefas concluídas",540,1070);
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
 const level=score===null?"Aguardando dados":score>=85?"Excelente consistência":score>=60?"Boa evolução":"Continue evoluindo";
 return <section aria-label="MYRYRA Score" className="rounded-[24px] bg-[#100d22] p-4 text-white sm:p-6">
  <header className="flex items-start justify-between gap-3">
   <div><p className="text-xs font-bold uppercase text-violet-300">MYRYRA SCORE</p><h2 className="mt-2 text-lg font-semibold">Sua evolução, em números.</h2></div>
   <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-slate-300">Versão beta</span>
  </header>
  <div className="mt-6 grid items-center gap-7 md:grid-cols-[minmax(190px,1fr)_minmax(0,1.4fr)]">
   <div className="flex flex-col items-center gap-3">
    <div className="relative grid h-40 w-40 place-items-center rounded-full" style={{background:score===null?"#302a48":`conic-gradient(#9d72ff 0 ${score}%, #302a48 ${score}% 100%)`}}>
     <div className="grid h-[136px] w-[136px] place-content-center rounded-full bg-[#100d22] text-center"><strong className="text-5xl font-bold tabular-nums">{loading?"…":score??"—"}</strong><span className="text-xs text-violet-200">de 100 pontos</span></div>
    </div>
    <p className="text-sm text-violet-100">{level}</p>
   </div>
   <div className="space-y-5">
    <div><div className="flex justify-between text-xs"><span>Tarefas</span><strong>{score===null?"—":score+"%"}</strong></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#302a48]"><div className="h-full rounded-full bg-[#9d72ff]" style={{width:(score??0)+"%"}} /></div><p className="mt-1 text-[11px] text-slate-400">{metrics?metrics.completed+" de "+metrics.total+" tarefas concluídas":"Aguardando dados"}</p></div>
    {["Planejamento","Foco","Equilíbrio"].map(label=><div key={label}><div className="flex justify-between text-xs"><span>{label}</span><span className="text-slate-400">Em breve</span></div><div className="mt-3 h-1.5 rounded-full bg-[#302a48]" /></div>)}
   </div>
  </div>
  <footer className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5">
   <p className="text-xs text-violet-100">Sua melhor versão começa hoje.</p>
   <button type="button" onClick={()=>void share()} disabled={score===null||loading} className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-[#100d22] hover:bg-violet-100 disabled:opacity-40">Compartilhar ↗</button>
  </footer>
  {notice&&<p role="status" className="mt-3 text-xs text-violet-200">{notice}</p>}
  <p className="mt-3 text-[11px] text-slate-400">Score beta = tarefas concluídas ÷ total de tarefas registradas × 100, arredondado. Sem tarefas, não há pontuação. Planejamento, Foco e Equilíbrio ainda não são calculados. O card inclui apenas pontuação e contagem agregada, sem dados pessoais.</p>
 </section>;
}
