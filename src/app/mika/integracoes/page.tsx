"use client";

import { useEffect, useState } from "react";

type Provider = {
  id: string;
  label: string;
  integration: string;
  capabilities: string[];
  note: string;
  connectionVerified: boolean;
  executionAvailable: boolean;
};

export default function MikaIntegracoesPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [googleStatus, setGoogleStatus] = useState<"idle" | "checking" | "connected" | "disconnected" | "reconnect" | "error">("idle");

  async function verifyGoogle() {
    setGoogleStatus("checking");
    try {
      const response = await fetch("/api/google/events", { credentials: "same-origin", cache: "no-store" });
      if (response.status === 409) { setGoogleStatus("reconnect"); return; }
      if (!response.ok) { setGoogleStatus("error"); return; }
      const data = await response.json();
      setGoogleStatus(data.connected === true ? "connected" : "disconnected");
    } catch { setGoogleStatus("error"); }
  }

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/mika/providers", { credentials: "same-origin", cache: "no-store", signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Não foi possível consultar as integrações.");
        return response.json();
      })
      .then((data) => {
        if (!Array.isArray(data.providers)) throw new Error("Resposta inválida.");
        setProviders(data.providers);
        setStatus("ready");
      })
      .catch(() => { if (!controller.signal.aborted) setStatus("error"); });
    return () => controller.abort();
  }, []);

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Integrações da MIKA</h1>
        <p className="text-sm text-gray-500">Conheça as capacidades disponíveis. A presença de um serviço não significa que sua conta esteja conectada.</p>
      </header>
      {status === "loading" && <p role="status">Consultando serviços...</p>}
      {status === "error" && <p role="alert">Não foi possível consultar os serviços. Entre na sua conta e tente novamente.</p>}
      {status === "ready" && (
        <div className="grid gap-3 sm:grid-cols-2">
          {providers.map((provider) => (
            <article key={provider.id} className="rounded-xl border border-gray-300/30 p-4 space-y-2">
              <h2 className="font-semibold">{provider.label}</h2>
              <p className="text-sm">{provider.integration === "external_link" ? "Somente abertura do aplicativo" : "API disponível no projeto — conexão não verificada"}</p>
              <p className="text-sm text-gray-500">{provider.note}</p>
              <p className="text-xs font-medium">{provider.connectionVerified ? "Conexão verificada" : "Conexão não verificada"}</p>
              <p className="text-xs">{provider.executionAvailable ? "Execução disponível" : "Execução externa indisponível"}</p>
              {provider.id === "google_calendar" && (
                <div className="space-y-2">
                  <button type="button" onClick={verifyGoogle} disabled={googleStatus === "checking"} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50">Verificar conexão Google</button>
                  {googleStatus === "checking" && <p role="status" className="text-xs">Verificando autorização e acesso à agenda...</p>}
                  {googleStatus === "connected" && <p role="status" className="text-xs">Leitura da agenda confirmada nesta sessão.</p>}
                  {googleStatus === "disconnected" && <p role="status" className="text-xs">Google Agenda não conectado. <a className="underline" href="/api/google/connect">Autorizar leitura</a></p>}
                  {googleStatus === "reconnect" && <p role="status" className="text-xs">A autorização precisa ser renovada. <a className="underline" href="/api/google/connect">Reconectar</a></p>}
                  {googleStatus === "error" && <p role="alert" className="text-xs">Não foi possível verificar a conexão. Confira sua sessão e tente novamente.</p>}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
      <p className="text-xs text-gray-500">A MIKA só poderá executar ações quando a autorização, as permissões e o adaptador forem verificados no servidor.</p>
    </main>
  );
}
