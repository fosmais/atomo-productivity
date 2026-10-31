"use client";
import Image from "next/image";

export default function MykaLoginScene() {
  return (
    <div aria-label="Conheça a MYKA, sua companheira inteligente" className="pointer-events-none relative mx-auto flex w-full max-w-[520px] flex-col items-center justify-center">
      <div className="relative w-full max-w-[440px] aspect-[1/0.77] overflow-hidden">
        <Image
          src="/myka-login-aprovada.png"
          alt="MYKA, gata roxa com círculo laranja e medalha 1618"
          width={1024}
          height={1024}
          priority
          sizes="(max-width: 1024px) 90vw, 440px"
          className="absolute left-0 top-0 h-auto w-full mix-blend-screen [mask-image:radial-gradient(ellipse_65%_54%_at_50%_39%,black_0%,black_78%,transparent_100%)]"
        />
      </div>
      <p className="relative mt-3 text-center text-sm font-medium tracking-[.25em] text-violet-200/80">CONHEÇA A MYKA</p>
      <p className="relative mt-2 max-w-sm text-center text-sm leading-relaxed text-slate-300">Sua companheira inteligente para transformar planos em conquistas.</p>
    </div>
  );
}
