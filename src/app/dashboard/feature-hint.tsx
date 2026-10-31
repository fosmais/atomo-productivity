"use client";

import { useEffect, useId, useRef, useState } from "react";

type Props = { label: string; title: string; description: string; tip?: string };

export default function FeatureHint({ label, title, description, tip }: Props) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);
  return <span ref={root} className="relative inline-flex max-w-full items-center gap-2 align-middle" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
    <span className="text-xs font-semibold uppercase tracking-widest text-violet-400">{label}</span>
    <button type="button" aria-label={`Sobre ${label}`} aria-expanded={open} aria-describedby={open ? id : undefined}
      onClick={() => setOpen(value => !value)} onFocus={() => setOpen(true)}
      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-violet-500/50 text-xs font-semibold text-violet-200 transition hover:border-violet-300 hover:bg-violet-500/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400">i</button>
    {open && <span id={id} role="tooltip" className="absolute bottom-full left-0 z-50 mb-2 w-[min(19rem,calc(100vw-3rem))] rounded-xl border border-violet-500/50 bg-slate-950 p-4 text-left normal-case tracking-normal text-white shadow-2xl shadow-violet-950/40">
      <strong className="block text-sm font-semibold text-violet-200">{title}</strong>
      <span className="mt-1 block text-sm font-normal leading-relaxed text-slate-200">{description}</span>
      {tip && <span className="mt-2 block text-xs font-normal text-slate-400">{tip}</span>}
    </span>}
  </span>;
}
