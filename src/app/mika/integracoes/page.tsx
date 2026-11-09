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
            </article>
          ))}
        </div>
      )}
      <p className="text-xs text-gray-500">A MIKA só poderá executar ações quando a autorização, as permissões e o adaptador forem verificados no servidor.</p>
    </main>
  );
}
