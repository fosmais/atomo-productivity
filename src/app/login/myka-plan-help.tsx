"use client";
import { useState } from "react";
import Link from "next/link";
import { BILLING_PLANS } from "@/lib/billing/plans";
export default function MykaPlanHelp(){
 const [open,setOpen]=useState(false);
 return <div className="relative z-10 mt-4 w-full max-w-md text-center">
  <button type="button" aria-expanded={open} aria-controls="myka-public-plan-help" onClick={()=>setOpen(v=>!v)} className="rounded-full border border-violet-400/50 bg-violet-600/20 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-600/40">Pergunte à MYKA sobre planos e pagamentos</button>
  {open&&<div id="myka-public-plan-help" className="mt-3 rounded-2xl border border-violet-400/30 bg-[#100d22] p-5 text-left text-sm text-slate-200 shadow-xl">
   <p className="font-semibold text-violet-200">Olá! Sou a MYKA 💜</p>
   <p className="mt-2">Posso mostrar os planos previstos para a MYRYRA. Os preços e benefícios ainda estão em homologação; não há cobrança disponível nesta versão.</p>
   <div className="mt-3 space-y-2">{Object.values(BILLING_PLANS).map(plan=><div key={plan.id} className="flex justify-between gap-3 rounded-lg bg-white/5 px-3 py-2"><span>{plan.name}</span><span>{new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(plan.monthlyPriceCents/100)}/mês*</span></div>)}</div>
   <p className="mt-2 text-xs text-slate-400">*Valores indicativos sujeitos a alteração.</p>
   <Link href="/planos" className="mt-4 inline-flex rounded-xl bg-violet-600 px-4 py-2 font-semibold text-white hover:bg-violet-500">Ver planos e informações de pagamento</Link>
   <p className="mt-3 text-xs text-slate-400">Não informe senhas ou dados de cartão. O checkout ainda não está habilitado.</p>
  </div>}
 </div>;
}
