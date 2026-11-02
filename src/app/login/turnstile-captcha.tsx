"use client";
import { useEffect, useRef, useState } from "react";
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
  const callbackRef = useRef(onToken);
  callbackRef.current = onToken;
  const [errorCode, setErrorCode] = useState<string | null>(null);
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
        callback: (token: string) => { setErrorCode(null); callbackRef.current(token); },
        "expired-callback": () => callbackRef.current(""),
        "error-callback": (code: string) => { setErrorCode(code || "unknown"); callbackRef.current(""); },
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
      callbackRef.current("");
    };
  }, [key]);
  return <div><div ref={ref} aria-label="Verificação antirobô" className="min-h-16" />{errorCode && <p role="alert" className="mt-2 text-xs text-rose-300">Falha na verificação de segurança (código {errorCode}). Atualize a página ou verifique se o domínio está autorizado no Cloudflare.</p>}</div>;
}
