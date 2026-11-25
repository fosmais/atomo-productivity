"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

declare global {
  interface Window {
    hcaptcha?: {
      render: (element: HTMLElement, options: Record<string, unknown>) => string;
      remove: (id: string) => void;
      reset: (id: string) => void;
    };
    myryraHcaptchaLoaded?: boolean;
    myryraHcaptchaReady?: () => void;
  }
}

function MobileCaptchaContent() {
  const params = useSearchParams();
  const state = params.get("state") || "";
  const [runtimeStatus, setRuntimeStatus] = useState("Carregando verificação de segurança...");
  const sitekey = process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY?.trim();
  const validState = /^[a-z0-9-]{12,100}$/i.test(state);
  const status = !validState
    ? "Solicitação inválida. Volte ao aplicativo e tente novamente."
    : !sitekey
      ? "A verificação de segurança está indisponível. Contate o suporte MYRYRA."
      : runtimeStatus;

  useEffect(() => {
    if (!validState || !sitekey) return;

    let cancelled = false;
    let widgetId: string | undefined;
    const container = document.getElementById("myryra-mobile-hcaptcha");
    const render = () => {
      if (cancelled || !container || !window.hcaptcha || widgetId !== undefined) return;
      widgetId = window.hcaptcha.render(container, {
        sitekey,
        theme: "dark",
        callback: (token: string) => {
          if (cancelled || !token) return;
          setRuntimeStatus("Verificação concluída. Retornando ao aplicativo...");
          const callback = new URL("myryra://captcha");
          callback.searchParams.set("token", token);
          callback.searchParams.set("state", state);
          window.location.replace(callback.toString());
        },
        "expired-callback": () => setRuntimeStatus("A verificação expirou. Conclua novamente."),
        "error-callback": () => setRuntimeStatus("Não foi possível validar. Atualize a página e tente novamente."),
      });
    };

    const previousReady = window.myryraHcaptchaReady;
    window.myryraHcaptchaReady = () => {
      window.myryraHcaptchaLoaded = true;
      previousReady?.();
      render();
    };
    let script = document.getElementById("myryra-mobile-hcaptcha-script") as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.id = "myryra-mobile-hcaptcha-script";
      script.src = "https://js.hcaptcha.com/1/api.js?render=explicit&onload=myryraHcaptchaReady";
      script.async = true;
      document.head.appendChild(script);
    }
    if (window.myryraHcaptchaLoaded) render();

    return () => {
      cancelled = true;
      if (window.myryraHcaptchaReady) window.myryraHcaptchaReady = previousReady;
      if (widgetId !== undefined) window.hcaptcha?.remove(widgetId);
    };
  }, [sitekey, state, validState]);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#070716] px-6 text-white">
      <section className="w-full max-w-md rounded-2xl border border-violet-400/30 bg-slate-950 p-6 shadow-2xl">
        <h1 className="text-center text-2xl font-bold tracking-wide">MYRYRA</h1>
        <p className="mt-2 text-center text-sm text-violet-200">Verificação de segurança</p>
        <div id="myryra-mobile-hcaptcha" className="mt-6 flex min-h-20 justify-center" />
        <p role="status" aria-live="polite" className="mt-4 text-center text-sm text-slate-300">{status}</p>
        <p className="mt-4 text-center text-xs text-slate-500">Após a validação, você retornará ao aplicativo MYRYRA.</p>
      </section>
    </main>
  );
}

export default function MobileCaptchaPage() {
  return <Suspense fallback={<main className="flex min-h-dvh items-center justify-center bg-[#070716] text-white">Carregando verificação...</main>}><MobileCaptchaContent /></Suspense>;
}
