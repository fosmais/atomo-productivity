"use client";

import ManualTaskImport from "./manual-task-import";
import ManualCalendarImport from "./manual-calendar-import";
import GoogleTasksImport from "./google-tasks-import";

const integrations = [
  {
    name: "Todoist",
    subtitle: "Tarefas e projetos",
    description: "Conecte sua conta para consultar tarefas e importar somente as selecionadas.",
    status: "Configuração pendente",
    connectUrl: null,
    connectLabel: null,
    sectionId: "myryra-todoist-import",
    docsUrl: "https://developer.todoist.com/",
  },
  {
    name: "Google Tasks",
    subtitle: "Listas e tarefas",
    description: "Consulte suas listas Google e confirme quais tarefas deseja importar.",
    status: "Consulta com autorização",
    connectUrl: "/api/google/connect",
    connectLabel: "Autorizar Google Tasks",
    sectionId: "myryra-google-tasks-import",
    docsUrl: "https://developers.google.com/workspace/tasks",
  },
  {
    name: "Microsoft Outlook",
    subtitle: "Calendário profissional",
    description: "Consulta de compromissos via Microsoft Graph, com autorização do usuário.",
    status: "Em breve",
    connectUrl: null,
    connectLabel: null,
    sectionId: "myryra-microsoft-calendar",
    docsUrl: "https://learn.microsoft.com/graph/api/resources/calendar",
  },
] as const;

export default function ExternalIntegrations() {
  return (
    <section className="space-y-4" aria-label="Integrações externas">
      <p className="text-sm leading-6 text-slate-300">
        Conecte suas ferramentas e escolha o que importar. A MYRYRA não modifica tarefas externas nesta etapa.
        Google Tasks pode ser consultado após autorização. Todoist e Outlook aguardam configuração e homologação antes de serem oferecidos para conexão.
      </p>
      <div className="grid gap-3 lg:grid-cols-3">
        {integrations.map(integration => (
          <article key={integration.name} className="flex min-w-0 flex-col gap-3 rounded-2xl border border-violet-400/20 bg-slate-900/75 p-4">
            <div>
              <h3 className="text-base font-semibold text-white">{integration.name}</h3>
              <p className="mt-1 text-xs font-medium text-violet-300">{integration.subtitle}</p>
            </div>
            <p className="flex-1 text-sm leading-6 text-slate-300">{integration.description}</p>
            <span className="w-fit rounded-full border border-amber-400/25 bg-amber-400/10 px-2.5 py-1 text-xs text-amber-200">
              {integration.status}
            </span>
            {integration.connectUrl && integration.connectLabel && integration.sectionId ? (
              <div className="flex flex-wrap gap-3 text-sm">
                <a href={integration.connectUrl} className="font-medium text-violet-200 underline underline-offset-4">
                  {integration.connectLabel}
                </a>
                <a href={`#${integration.sectionId}`} className="text-violet-300 underline underline-offset-4">
                  Consultar e importar
                </a>
              </div>
            ) : <p className="text-xs text-slate-400">Conexão disponível após homologação.</p>}
            <a href={integration.docsUrl} target="_blank" rel="noopener noreferrer"
              className="text-sm font-medium text-violet-300 underline underline-offset-4 hover:text-violet-100">
              Documentação da API
            </a>
          </article>
        ))}
      </div>
      <div id="myryra-google-tasks-import" className="scroll-mt-24"><GoogleTasksImport /></div>
      {/* Fluxos Todoist e Outlook ficam ocultos até a configuração OAuth e homologação. */}
      <ManualTaskImport />
      <ManualCalendarImport />
      <p className="text-xs leading-5 text-slate-400">
        As importações exigem confirmação. Conectar uma conta não inicia sincronização automática.
      </p>
    </section>
  );
}
