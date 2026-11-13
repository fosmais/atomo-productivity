"use client";

import Image from "next/image";
import { useState } from "react";

export default function MykaPortrait({ className = "h-full w-full" }: { className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span role="img" aria-label="MYKA, sua assistente inteligente" className={`${className} flex items-center justify-center rounded-full bg-cyan-950/80 text-cyan-100`}>
        <span aria-hidden="true" className="text-lg font-bold leading-none">M</span>
      </span>
    );
  }
  return (
    <Image
      src="/mika-flow-portrait.svg"
      alt="MIKA, gata branca com olhos azuis e medalha dourada 1618"
      width={1024}
      height={1024}
      unoptimized
      onError={() => setFailed(true)}
      className={`${className} object-cover rounded-full`}
      sizes="(max-width: 640px) 90vw, 420px"
      priority
    />
  );
}
