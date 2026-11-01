"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

const prefix = "myryra:expanded:v1:";
const eventName = "myryra:accordion-all";
function storedOpen(userId: string, id: string, initial: boolean): boolean {
  try {
    const value = localStorage.getItem(prefix + userId + ":" + id);
    return value === null ? initial : value === "true";
  } catch { return initial; }
}

export function FeatureAccordion({ id, title, description, userId, defaultOpen = false, children }: {
  id: string; title: string; description: string; userId: string; defaultOpen?: boolean; children: ReactNode;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const helpId = useId();
  const helpRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!helpOpen) return;
    const outside = (event: PointerEvent) => { if (!helpRef.current?.contains(event.target as Node)) setHelpOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setHelpOpen(false); };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [helpOpen]);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.open = storedOpen(userId, id, defaultOpen);
    const onAll = (event: Event) => {
      const detail = (event as CustomEvent<{ open: boolean }>).detail;
      if (typeof detail?.open === "boolean") node.open = detail.open;
    };
    window.addEventListener(eventName, onAll);
    return () => window.removeEventListener(eventName, onAll);
  }, [id, userId, defaultOpen]);
  return <details ref={ref} onToggle={event => {
    if (!event.currentTarget.isConnected) return;
    try { localStorage.setItem(prefix + userId + ":" + id, String(event.currentTarget.open)); } catch { /* optional */ }
  }} className="group relative min-w-0 rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/90 to-[#101026] shadow-[0_10px_28px_rgba(0,0,0,0.14)] transition-all duration-200 hover:border-violet-400/30 hover:shadow-[0_12px_34px_rgba(93,38,180,0.12)] open:border-violet-400/35 open:shadow-[0_14px_36px_rgba(93,38,180,0.16)]">
    <summary className="flex min-h-[92px] cursor-pointer list-none items-center justify-between gap-4 px-5 py-5 pr-24 text-left marker:hidden transition-colors hover:bg-white/[0.025] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400 sm:pl-6 sm:pr-28 [&::-webkit-details-marker]:hidden">
      <span className="min-w-0"><span className="block text-[15px] font-semibold tracking-tight text-white sm:text-base">{title}</span><span className="mt-1.5 block text-sm leading-relaxed text-slate-400">{description}</span></span>
      <span aria-hidden="true" className="absolute right-5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl border border-violet-400/25 bg-violet-500/10 text-xl text-violet-200 transition-all duration-200 group-hover:bg-violet-500/20 group-open:rotate-45 group-open:border-violet-400/50">+</span>
    </summary>
    <div ref={helpRef} className="absolute right-16 top-1/2 z-20 -translate-y-1/2">
      <button type="button" aria-label={`Como funciona: ${title}`} aria-expanded={helpOpen} aria-controls={helpOpen ? helpId : undefined}
        onClick={() => setHelpOpen((value) => !value)}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-violet-400/45 bg-violet-500/10 text-xs font-semibold text-violet-200 transition hover:bg-violet-500/25 focus-visible:outline-2 focus-visible:outline-violet-400">i</button>
      {helpOpen && <div id={helpId} role="region" aria-label={`Sobre ${title}`}
        className="absolute right-0 top-full z-30 mt-2 w-[min(19rem,calc(100vw-3rem))] rounded-xl border border-violet-400/50 bg-slate-950 p-4 text-left shadow-2xl">
        <strong className="block text-sm font-semibold text-violet-200">{title}</strong>
        <p className="mt-2 text-sm leading-relaxed text-slate-200">{description}</p>
        <p className="mt-2 text-xs text-slate-400">Toque no cartão para abrir a ferramenta.</p>
      </div>}
    </div>
    <div className="min-w-0 space-y-4 border-t border-white/10 bg-slate-950/35 px-4 py-5 sm:px-6">{children}</div>
  </details>;
}

export function AccordionControls() {
  return <div className="flex flex-wrap justify-end gap-2" aria-label="Controles dos painéis">
    <button type="button" onClick={() => window.dispatchEvent(new CustomEvent(eventName, { detail: { open: true } }))} className="rounded-lg border border-violet-400/30 px-3 py-2 text-xs font-medium text-violet-200 hover:bg-violet-500/15">Expandir todos</button>
    <button type="button" onClick={() => window.dispatchEvent(new CustomEvent(eventName, { detail: { open: false } }))} className="rounded-lg border border-violet-400/30 px-3 py-2 text-xs font-medium text-violet-200 hover:bg-violet-500/15">Recolher todos</button>
  </div>;
}
