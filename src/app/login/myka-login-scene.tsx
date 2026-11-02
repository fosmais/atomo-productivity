"use client";
import Image from "next/image";

export default function MykaLoginScene() {
  return (
    <div aria-label="Conheça a MYKA, sua companheira inteligente" className="relative mx-auto flex w-full max-w-[310px] flex-col items-center justify-center">
      <div className="pointer-events-none w-full"><Image
        src="/myka-transparente.png"
        alt="MYKA, gata roxa com círculo laranja e medalha 1618"
        width={1240}
        height={1240}
        priority
        sizes="(max-width: 1024px) 80vw, 250px"
        className="relative h-auto w-full max-w-[235px] xl:max-w-[250px]"
      /></div>
      <p className="relative mt-5 text-center text-sm font-medium tracking-[.25em] text-violet-200/80">CONHEÇA A MYKA</p>
      <p className="relative mt-2 max-w-sm text-center text-sm leading-relaxed text-slate-300">Sua companheira inteligente para transformar planos em conquistas.</p>
    </div>
  );
}
