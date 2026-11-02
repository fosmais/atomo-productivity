"use client";
import { useEffect, useRef } from "react";
declare global {
  interface Window {
    turnstile?: {
      render: (element: HTMLElement, options: Record<string, unknown>) => string;
      remove: (widgetId: string) => void;
    };
  }
}
export default function TurnstileCaptcha({ onToken }: { onToken: (token: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const key = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  useEffect(() => {
    if (!key || !ref.current) return;
    let cancelled = false;
    let widgetId: string | undefined;
    const render = () => {
      if (cancelled || !ref.current || !window.turnstile || widgetId !== undefined) return;
      widgetId = window.turnstile.render(ref.current, {
        sitekey: key,
        theme: "dark",
        callback: (token: string) => onToken(token),
        "expired-callback": () => onToken(""),
        "error-callback": () => onToken(""),
      });
    };
    let script = document.getElementById("myryra-turnstile") as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.id = "myryra-turnstile";
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      document.head.appendChild(script);
    }
    script.addEventListener("load", render);
    const poll = window.setInterval(render, 250);
    render();
    return () => {
      cancelled = true;
      window.clearInterval(poll);
      script?.removeEventListener("load", render);
      if (widgetId !== undefined) window.turnstile?.remove(widgetId);
      onToken("");
    };
  }, [key, onToken]);
  return <div ref={ref} aria-label="Verificação antirobô" className="min-h-16" />;
}
