"use client";

import { useEffect, useState } from "react";
import { listExternalAppConnections } from "@/lib/mika/external-app-connections";

type App = ReturnType<typeof listExternalAppConnections>[number];

const labels = {
  available_to_open: "Disponível para abrir",
  not_connected: "Não conectado",
  authorization_required: "Autorização necessária",
  connected: "Conectado",
} as const;

/** Read-only: no connection is represented as authorized without provider verification. */
export default function MikaAppConnections() {
  const [expanded, setExpanded] = useState(false);
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!expanded) return;
    const controller = new AbortController();
    async function loadApps() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch("/api/mika/external-apps", {
          credentials: "same-origin",
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Falha na consulta");
        const data: unknown = await response.json();
        if (!data || typeof data !== "object" || !("apps" in data) || !Array.isArray(data.apps)) {
          throw new Error("Resposta inválida");
        }
        const valid = data.apps.every((app: unknown) =>
          app !== null && typeof app === "object" &&
          "id" in app && typeof app.id === "string" &&
          "label" in app && typeof app.label === "string" &&
          "handoffUrl" in app && typeof app.handoffUrl === "string" &&
          "status" in app && typeof app.status === "string" && app.status in labels
        );
        if (!valid) throw new Error("Resposta inválida");
        if (!controller.signal.aborted) setApps(data.apps as App[]);
      } catch {
        if (!controller.signal.aborted) {
          setApps([]);
          setError("Não foi possível consultar os aplicativos. Tente novamente.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void loadApps();
    return () => controller.abort();
  }, [expanded]);

  return (
    <section className="mb-4 rounded-xl border border-violet-400/25 bg-slate-900/70 p-3 text-white">
      <button type="button" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}
        className="flex w-full items-center justify-between gap-3 text-left text-sm font-semibold text-violet-100">
        <span>Aplicativos e permissões</span>
        <span aria-hidden="true">{expanded ? "−" : "+"}</span>
      </button>
      {expanded && (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-slate-300">Os aplicativos podem ser abertos, mas nenhuma ação externa é executada automaticamente.</p>
          {loading && <p className="text-xs text-violet-200" role="status">Consultando aplicativos...</p>}
          {error && <p className="text-xs text-amber-200" role="alert">{error}</p>}
          {!loading && !error && (
            <div className="grid gap-2 sm:grid-cols-2">
              {apps.map(app => (
                <div key={app.id} className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-slate-800/70 p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{app.label}</p>
                    <p className="text-xs text-slate-300">{labels[app.status]}</p>
                  </div>
                  <a href={app.handoffUrl} target="_blank" rel="noopener noreferrer"
                    className="shrink-0 rounded-lg border border-violet-400/40 px-3 py-2 text-xs text-violet-100">Abrir</a>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-slate-400">Abrir um aplicativo não concede permissões. A central ainda não verifica tokens OAuth nem executa operações por API.</p>
        </div>
      )}
    </section>
  );
}
