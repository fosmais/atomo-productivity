"use client";
import Image from "next/image";

export default function MykaLoginScene() {
  return (
    <div aria-label="Conheça a MYKA, sua companheira inteligente" className="pointer-events-none relative mx-auto flex w-full max-w-[520px] flex-col items-center justify-center">
      <div className="relative w-full max-w-[440px] overflow-hidden">
        <Image
          src="/myka-login-aprovada.png"
          alt="MYKA, gata roxa com círculo laranja e medalha 1618"
          width={1024}
          height={1024}
          priority
          sizes="(max-width: 1024px) 90vw, 440px"
          className="relative h-auto w-full mix-blend-screen [mask-image:radial-gradient(ellipse_at_50%_43%,black_0%,black_43%,transparent_65%)]"
        />
      </div>
      <p className="relative -mt-5 text-center text-sm font-medium tracking-[.25em] text-violet-200/80">CONHEÇA A MYKA</p>
      <p className="relative mt-2 max-w-sm text-center text-sm leading-relaxed text-slate-300">Sua companheira inteligente para transformar planos em conquistas.</p>
    </div>
  );
}
