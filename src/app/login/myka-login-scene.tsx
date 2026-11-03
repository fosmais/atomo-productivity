"use client";
import Image from "next/image";

export default function MykaLoginScene() {
  return (
    <div aria-label="Conheça a MYKA, sua companheira inteligente" className="relative mx-auto flex w-full max-w-[310px] flex-col items-center justify-center">
      <div className="pointer-events-none flex w-full justify-center"><Image
        src="/myka-transparente.png"
        alt="MYKA, gata roxa com círculo laranja e medalha 1618"
        width={1240}
        height={1240}
        priority
        sizes="(max-width: 1024px) 80vw, 250px"
        className="relative h-auto w-full max-w-[235px] xl:max-w-[250px]"
      /></div>
      <p className="relative mt-5 text-center text-sm font-medium tracking-[.25em] text-violet-200/80">CONHEÇA A MYKA</p>
      <h2 className="relative mt-3 text-center text-2xl font-bold leading-tight text-white">Seu universo, <span className="text-violet-300">em sintonia.</span></h2>
      <p className="relative mt-3 max-w-[310px] text-center text-base leading-relaxed text-slate-200">Compromissos, tarefas e metas em um só lugar. Com a MYKA, você organiza prioridades e encontra tempo para o que importa.</p>
      <p className="relative mt-3 max-w-[310px] text-center text-sm font-semibold leading-relaxed text-violet-200">Mais que uma agenda: inteligência para transformar planos em ação.</p>
    </div>
  );
}
