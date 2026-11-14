"use client";
import Image from "next/image";
import { useState } from "react";

export default function MykaLoginScene() {
  const [imageFailed, setImageFailed] = useState(false);
  return (
    <div aria-label="Conheça a MYKA, sua companheira inteligente" className="relative mx-auto flex w-full max-w-[430px] flex-col items-center justify-center">
      <div className="pointer-events-none flex w-full justify-center">{imageFailed ? (
        <div role="img" aria-label="MYKA, sua companheira inteligente" className="flex h-[210px] w-[210px] flex-col items-center justify-center rounded-full border border-violet-300/50 bg-violet-900/50 shadow-[0_0_65px_rgba(139,92,246,.35)]">
          <span aria-hidden="true" className="text-6xl">🐈</span>
          <span className="mt-2 text-xl font-bold tracking-[.3em] text-violet-100">MYKA</span>
          <span className="text-xs font-semibold text-orange-300">1618</span>
        </div>
      ) : <Image
        src="/myka-transparente.png"
        alt="MYKA, gata roxa com círculo laranja e medalha 1618"
        width={1240}
        height={1240}
        priority
        unoptimized
        onError={() => setImageFailed(true)}
        sizes="(max-width: 1024px) 80vw, 250px"
        className="relative h-auto w-full max-w-[210px] xl:max-w-[225px]"
      />}</div>
      <p className="relative mt-4 text-center text-xs font-semibold tracking-[.2em] text-violet-200/85">CONHEÇA A MYKA</p>
      <h2 className="relative mt-3 text-center text-[clamp(1.7rem,2.3vw,2.15rem)] font-bold leading-tight tracking-tight text-white">Sua vida, em <span className="text-violet-300">sintonia.</span></h2>
      <p className="relative mt-3 max-w-[390px] text-center text-base leading-7 text-slate-200">Tarefas, agenda e metas organizadas em um só lugar.</p>
      <p className="relative mt-2 max-w-[390px] text-center text-sm leading-6 text-violet-200">A MYKA ajuda você a priorizar o que importa e transformar planos em ação.</p>
    </div>
  );
}
