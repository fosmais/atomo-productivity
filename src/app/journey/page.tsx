import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import MikaJourneyPlanner from "../dashboard/mika-journey-planner";
import JourneyTrail from "./journey-trail";

async function JourneyContent() {
  await connection();
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");
  const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error || (assurance.data.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2")) redirect("/login");
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#070b1a] px-3 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-5 text-white sm:px-6 lg:py-8 lg:pb-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <nav className="flex items-center justify-between gap-3">
          <Link href="/dashboard" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-violet-400/20 bg-violet-500/10 px-3 text-sm text-violet-200 hover:bg-violet-500/20">← Meu universo</Link>
          <span className="text-[11px] font-bold uppercase tracking-[.2em] text-violet-300">MYRYRA · JOURNEY</span>
        </nav>
        <header className="relative isolate overflow-hidden rounded-[28px] border border-violet-400/30 bg-gradient-to-br from-[#26104d] via-[#151330] to-[#0b1124] p-5 sm:p-8">
          <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-fuchsia-500/20 blur-3xl" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 left-12 h-48 w-48 rounded-full bg-indigo-500/20 blur-3xl" />
          <div className="relative grid items-center gap-5 md:grid-cols-[minmax(0,1fr)_200px]">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[.22em] text-violet-200">✦ Seu universo em evolução</p>
              <h1 className="mt-3 max-w-2xl text-3xl font-bold leading-tight tracking-tight sm:text-4xl">Grandes sonhos. <span className="text-violet-300">Pequenos passos reais.</span></h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">Crie uma jornada, acompanhe suas missões e avance no seu ritmo. A MIKA ajuda você a transformar objetivos em conquistas.</p>
              <div className="mt-5 flex flex-wrap gap-3">
                <a href="#journey-create-details" className="inline-flex min-h-11 items-center rounded-xl bg-violet-500 px-5 text-sm font-semibold text-white shadow-lg shadow-violet-950/40 hover:bg-violet-400">＋ Criar jornada</a>
                <a href="#journey-trail" className="inline-flex min-h-11 items-center rounded-xl border border-violet-300/30 bg-white/5 px-5 text-sm font-semibold text-violet-100 hover:bg-white/10">Explorar minhas jornadas ↓</a>
              </div>
            </div>
            <div className="mx-auto flex h-40 w-40 items-center justify-center rounded-full border border-violet-400/40 bg-violet-950/40 shadow-[0_0_45px_rgba(139,92,246,.25)] sm:h-48 sm:w-48">
              <img src="/myka-transparente.png" alt="MIKA original da MYRYRA" className="h-full w-full object-contain p-2" />
            </div>
          </div>
          <div className="relative mt-6 grid grid-cols-3 gap-2 border-t border-violet-300/15 pt-5">
            <div className="rounded-xl bg-white/5 p-3"><p className="text-lg text-violet-200">✦</p><p className="mt-1 text-xs font-semibold text-white">Defina seu sonho</p><p className="mt-1 hidden text-[11px] text-slate-400 sm:block">Escolha a direção</p></div>
            <div className="rounded-xl bg-white/5 p-3"><p className="text-lg text-violet-200">◇</p><p className="mt-1 text-xs font-semibold text-white">Cumpra missões</p><p className="mt-1 hidden text-[11px] text-slate-400 sm:block">Um passo de cada vez</p></div>
            <div className="rounded-xl bg-white/5 p-3"><p className="text-lg text-violet-200">◎</p><p className="mt-1 text-xs font-semibold text-white">Veja sua evolução</p><p className="mt-1 hidden text-[11px] text-slate-400 sm:block">Celebre conquistas</p></div>
          </div>
        </header>
        <section id="journey-trail" className="scroll-mt-6 space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div><p className="text-[11px] font-bold uppercase tracking-[.2em] text-violet-300">Meu mapa de evolução</p><h2 className="mt-1 text-xl font-bold sm:text-2xl">Minhas jornadas</h2></div>
            <a href="#journey-create-details" className="text-sm font-semibold text-violet-300 hover:text-violet-100">＋ Nova jornada</a>
          </div>
          <JourneyTrail />
        </section>
        <div className="grid gap-3 md:grid-cols-2">
          <Link href="/mika-professora" className="flex min-h-24 items-center gap-3 rounded-2xl border border-violet-400/30 bg-violet-950/30 p-4 transition hover:bg-violet-900/40">
            <img src="/myka-transparente.png" alt="" className="h-14 w-14 shrink-0 object-contain" />
            <span className="min-w-0 flex-1"><strong className="block text-sm">MIKA Professora</strong><span className="mt-1 block text-xs leading-5 text-slate-300">Aprenda com aulas personalizadas conectadas aos seus objetivos.</span></span><span aria-hidden="true" className="text-violet-200">→</span>
          </Link>
          <div className="flex min-h-24 items-center gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4"><span className="text-2xl text-amber-300">✧</span><div><strong className="text-sm">Conquistas MYRA</strong><p className="mt-1 text-xs leading-5 text-slate-300">Complete missões para conquistar MYRAs virtuais, sem valor monetário.</p></div></div>
        </div>
        <details id="journey-create-details" className="scroll-mt-6 rounded-2xl border border-violet-400/25 bg-[#15132c] p-4 sm:p-5">
          <summary className="cursor-pointer text-sm font-semibold text-violet-100">＋ Criar ou planejar uma nova jornada</summary>
          <div className="mt-4"><MikaJourneyPlanner /></div>
        </details>
        <p className="pb-4 text-center text-xs text-slate-400">Jornadas compartilhadas estão em desenvolvimento. MYRAs não possuem valor monetário.</p>
        <nav aria-label="Navegação principal MYRYRA" className="fixed inset-x-0 bottom-0 z-40 border-t border-violet-400/20 bg-[#081321]/95 px-2 pb-[env(safe-area-inset-bottom)] pt-2 shadow-2xl backdrop-blur-xl lg:hidden">
          <div className="grid grid-cols-4 gap-1.5">
            {[
              { label: "Hoje", icon: "⌂", href: "/dashboard" },
              { label: "MIKA", icon: "✦", href: "/dashboard#vyra-ai" },
              { label: "Jornadas", icon: "◈", href: "/journey", active: true },
              { label: "Espaços", icon: "▦", href: "/dashboard#spaces" },
            ].map(item => <Link key={item.label} href={item.href} aria-current={item.active ? "page" : undefined} className={`flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 rounded-xl border px-2 py-2 text-[11px] font-medium focus-visible:outline-2 focus-visible:outline-violet-400 ${item.active ? "border-violet-400/70 bg-violet-400/15 text-white" : "border-transparent text-slate-300 hover:bg-slate-800/80 hover:text-white"}`}><span className="text-xl leading-none" aria-hidden="true">{item.icon}</span><span className="truncate">{item.label}</span></Link>)}
          </div>
        </nav>
      </div>
    </main>
  );
}

export default function JourneyPage() {
  return <Suspense fallback={<main className="min-h-screen bg-slate-950 p-6 text-slate-300">Carregando MYRYRA Journey...</main>}><JourneyContent /></Suspense>;
}
