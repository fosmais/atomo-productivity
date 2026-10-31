"use client";

import Image from "next/image";

export default function MykaPortrait({ className = "h-full w-full" }: { className?: string }) {
  return (
    <Image
      src="/myka-transparente.png"
      alt="MYKA, gata roxa com aura laranja e medalha 1618"
      width={1024}
      height={1024}
      className={`${className} mix-blend-screen [mask-image:radial-gradient(circle_at_50%_50%,black_0%,black_54%,transparent_68%)]`}
      sizes="(max-width: 640px) 90vw, 420px"
      priority
    />
  );
}
