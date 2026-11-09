"use client";

import { useState } from "react";
import { listExternalAppConnections } from "@/lib/mika/external-app-connections";

const labels = {
  available_to_open: "Disponível para abrir",
  not_connected: "Não conectado",
  authorization_required: "Autorização necessária",
  connected: "Conectado",
} as const;

/** Read-only until verified, per-user OAuth connection records are available. */
export default function MikaAppConnections() {
  const [expanded, setExpanded] = useState(false);
  const apps = listExternalAppConnections();
  return (
    <section className="mb-4 rounded-xl border border-violet-400/25 bg-slate-900/70 p-3 text-white">
      <button type="button" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}
        className="flex w-full items-center justify-between gap-3 text-left text-sm font-semibold text-violet-100">
        <span>Aplicativos e permissões</span>
        <span aria-hidden="true">{expanded ? "−" : "+"}</span>
      </button>
      {expanded && (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-slate-300">Os serviços abaixo podem ser abertos. Ainda não há autorização para a MIKA executar ações nesses aplicativos.</p>
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
          <p className="text-xs text-slate-400">Abrir um aplicativo não concede permissões nem executa operações. Conexões OAuth serão disponibilizadas apenas após integração e validação de segurança.</p>
        </div>
      )}
    </section>
  );
}
