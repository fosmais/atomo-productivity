"use client";
import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    hcaptcha?: {
      render: (element: HTMLElement, options: Record<string, unknown>) => string;
      remove: (id: string) => void;
      reset: (id: string) => void;
    };
  }
}

export default function HcaptchaCaptcha({ onToken, resetSignal }: { onToken: (token: string) => void; resetSignal: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | undefined>(undefined);
  const callback = useRef(onToken);
  useEffect(() => { callback.current = onToken; }, [onToken]);
  const [failed, setFailed] = useState(false);
  const sitekey = process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY?.trim();

  useEffect(() => {
    if (!sitekey || !ref.current) return;
    let cancelled = false;
    let id: string | undefined;
    const render = () => {
      if (cancelled || !ref.current || !window.hcaptcha || id !== undefined) return;
      id = window.hcaptcha.render(ref.current, {
        sitekey,
        theme: "dark",
        callback: (token: string) => { setFailed(false); callback.current(token); },
        "expired-callback": () => callback.current(""),
        "error-callback": () => { setFailed(true); callback.current(""); },
      });
      widgetId.current = id;
    };
    // The hCaptcha global may exist before its API is fully initialized.
    // Wait for the official onload callback rather than polling render().
    const onReadyName = "myryraHcaptchaReady";
    const win = window as Window & { myryraHcaptchaReady?: () => void; myryraHcaptchaLoaded?: boolean };
    const previousReady = win.myryraHcaptchaReady;
    win.myryraHcaptchaReady = () => {
      win.myryraHcaptchaLoaded = true;
      previousReady?.();
      render();
    };
    let script = document.getElementById("myryra-hcaptcha") as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.id = "myryra-hcaptcha";
      script.src = `https://js.hcaptcha.com/1/api.js?render=explicit&onload=${onReadyName}`;
      script.async = true;
      document.head.appendChild(script);
    }
    if (win.myryraHcaptchaLoaded) render();
    return () => {
      cancelled = true;
      if (win.myryraHcaptchaReady && previousReady !== win.myryraHcaptchaReady) win.myryraHcaptchaReady = previousReady;
      if (id !== undefined) window.hcaptcha?.remove(id);
      widgetId.current = undefined;
      callback.current("");
    };
  }, [sitekey]);
  useEffect(() => {
    if (resetSignal > 0 && widgetId.current !== undefined) {
      window.hcaptcha?.reset(widgetId.current);
      callback.current("");
    }
  }, [resetSignal]);
  return <div><div ref={ref} aria-label="Verificação antirobô" className="min-h-16" />{failed && <p role="alert" className="mt-2 text-xs text-rose-300">Não foi possível concluir a verificação hCaptcha. Tente novamente.</p>}</div>;
}
