"use client";
import MykaPortrait from "@/components/myka-portrait";

export default function MykaLoginScene() {
  return <div aria-hidden="true" className="pointer-events-none relative mx-auto flex w-full max-w-[520px] flex-col items-center justify-center">
    <div className="absolute inset-0 rounded-full bg-violet-600/15 blur-[90px]" />
    <MykaPortrait className="relative w-full max-w-[390px] drop-shadow-[0_30px_75px_rgba(120,65,255,.4)]" />
    <p className="relative mt-3 text-center text-sm font-medium tracking-[.25em] text-violet-200/80">CONHEÇA A MYKA</p>
    <p className="relative mt-2 max-w-sm text-center text-sm leading-relaxed text-slate-300">Sua companheira inteligente para transformar planos em conquistas.</p>
  </div>;
}
