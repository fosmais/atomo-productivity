"use client";

import Image from "next/image";

export default function MykaPortrait({ className = "h-full w-full" }: { className?: string }) {
  return (
    <Image
      src="/myka-oficial.png"
      alt="MYKA, gata roxa com aura laranja e medalha 1618"
      width={1024}
      height={1024}
      className={`${className} [mask-image:radial-gradient(ellipse_68%_68%_at_50%_50%,black_72%,transparent_100%)]`}
      sizes="(max-width: 640px) 90vw, 420px"
      priority
    />
  );
}
