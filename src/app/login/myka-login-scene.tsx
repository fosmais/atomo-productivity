"use client";
import Image from "next/image";

export default function MykaLoginScene() {
  return (
    <div aria-label="Conheça a MYKA, sua companheira inteligente" className="pointer-events-none relative mx-auto flex w-full max-w-[520px] items-center justify-center">
      <Image
        src="/myka-login-aprovada.png"
        alt="MYKA, gata roxa com círculo laranja e medalha 1618. Conheça a MYKA: sua companheira inteligente para transformar planos em conquistas."
        width={1024}
        height={1024}
        priority
        sizes="(max-width: 1024px) 90vw, 520px"
        className="relative h-auto w-full mix-blend-screen [mask-image:radial-gradient(ellipse_at_50%_50%,black_0%,black_69%,transparent_83%)]"
      />
    </div>
  );
}
