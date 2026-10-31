"use client";

import { useEffect, useRef, type ReactNode } from "react";

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
  }} className="group min-w-0 rounded-2xl border border-violet-400/20 bg-slate-900/60 shadow-sm transition-colors open:border-violet-400/40 open:bg-slate-900/80">
    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 py-4 text-left marker:hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400 sm:px-5 [&::-webkit-details-marker]:hidden">
      <span className="min-w-0"><span className="block text-base font-semibold text-white">{title}</span><span className="mt-1 block text-xs leading-relaxed text-slate-400">{description}</span></span>
      <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-violet-500/40 text-xl text-violet-200 transition-transform group-open:rotate-45">+</span>
    </summary>
    <div className="min-w-0 space-y-4 border-t border-violet-400/15 px-3 py-4 sm:px-5">{children}</div>
  </details>;
}

export function AccordionControls() {
  return <div className="flex flex-wrap justify-end gap-2" aria-label="Controles dos painéis">
    <button type="button" onClick={() => window.dispatchEvent(new CustomEvent(eventName, { detail: { open: true } }))} className="rounded-lg border border-violet-400/30 px-3 py-2 text-xs font-medium text-violet-200 hover:bg-violet-500/15">Expandir todos</button>
    <button type="button" onClick={() => window.dispatchEvent(new CustomEvent(eventName, { detail: { open: false } }))} className="rounded-lg border border-violet-400/30 px-3 py-2 text-xs font-medium text-violet-200 hover:bg-violet-500/15">Recolher todos</button>
  </div>;
}
