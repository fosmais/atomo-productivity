"use client";

/**
 * Isolated MVP2 integration status cards for review.
 * This component is intentionally NOT mounted in the production dashboard.
 * No OAuth endpoints or external API access are enabled by these cards.
 */
const integrations = [
  {
    name: "Google Tasks",
    subtitle: "Listas e tarefas",
    description: "Conexão e importação seletiva previstas após configuração e homologação.",
    status: "Aguardando homologação",
    docsUrl: "https://developers.google.com/workspace/tasks",
  },
  {
    name: "Todoist",
    subtitle: "Tarefas e projetos",
    description: "Conexão e importação seletiva previstas após configuração e homologação.",
    status: "Aguardando homologação",
    docsUrl: "https://developer.todoist.com/",
  },
  {
    name: "Microsoft Outlook",
    subtitle: "Calendário",
    description: "Consulta somente leitura prevista após registro da aplicação Microsoft e autorização do usuário.",
    status: "Aguardando configuração Microsoft",
    docsUrl: "https://learn.microsoft.com/graph/api/resources/calendar",
  },
] as const;

export default function IntegrationStatusCards() {
  return (
    <section aria-label="Integrações externas em homologação" className="space-y-3">
      <h2 className="text-xl font-semibold text-white">Integrações externas</h2>
      <p className="text-sm text-slate-300">
        Estas integrações ainda não estão disponíveis neste ambiente. Nenhuma conta será conectada automaticamente.
      </p>
      <div className="grid gap-3 md:grid-cols-3">
        {integrations.map((integration) => (
          <article key={integration.name} className="flex flex-col gap-3 rounded-2xl border border-violet-400/20 bg-slate-900 p-4">
            <div>
              <h3 className="font-semibold text-white">{integration.name}</h3>
              <p className="text-xs text-violet-300">{integration.subtitle}</p>
            </div>
            <p className="flex-1 text-sm text-slate-300">{integration.description}</p>
            <span className="w-fit rounded-full border border-amber-400/25 bg-amber-400/10 px-2.5 py-1 text-xs text-amber-200">
              {integration.status}
            </span>
            <a href={integration.docsUrl} target="_blank" rel="noopener noreferrer"
              className="text-sm text-violet-300 underline underline-offset-4">
              Documentação da integração
            </a>
          </article>
        ))}
      </div>
    </section>
  );
}
