"use client";

import ManualTaskImport from "./manual-task-import";
import ManualCalendarImport from "./manual-calendar-import";
import GoogleTasksImport from "./google-tasks-import";
import TodoistImport from "./todoist-import";

const integrations = [
  {
    name: "Todoist",
    subtitle: "Tarefas e projetos",
    description: "Importar tarefas e projetos existentes para organizar seu dia com a MYKA.",
    url: "https://developer.todoist.com/",
    label: "Documentação da API",
  },
  {
    name: "Google Tasks",
    subtitle: "Listas e tarefas",
    description: "Aproveitar tarefas do Google sem misturá-las automaticamente com eventos do calendário.",
    url: "https://developers.google.com/workspace/tasks",
    label: "Documentação da API",
  },
  {
    name: "Microsoft Outlook",
    subtitle: "Calendário profissional",
    description: "Consultar compromissos do Outlook para planejar disponibilidade e prioridades.",
    url: "https://learn.microsoft.com/graph/api/resources/calendar",
    label: "Documentação da API",
  },
];

export default function ExternalIntegrations() {
  return (
    <section className="space-y-4" aria-label="Integrações externas">
      <p className="text-sm leading-6 text-slate-300">
        Prepare suas ferramentas para trabalhar com a MYRYRA. Google Tasks oferece consulta e importação sob demanda mediante autorização.
        Todoist e Outlook permanecem em desenvolvimento.
      </p>
      <div className="grid gap-3 lg:grid-cols-3">
        {integrations.map((integration) => (
          <article key={integration.name} className="flex min-w-0 flex-col gap-3 rounded-2xl border border-violet-400/20 bg-slate-900/75 p-4">
            <div>
              <h3 className="text-base font-semibold text-white">{integration.name}</h3>
              <p className="mt-1 text-xs font-medium text-violet-300">{integration.subtitle}</p>
            </div>
            <p className="flex-1 text-sm leading-6 text-slate-300">{integration.description}</p>
            <span className="w-fit rounded-full border border-amber-400/25 bg-amber-400/10 px-2.5 py-1 text-xs text-amber-200">Integração em desenvolvimento</span>
            <a href={integration.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-violet-300 underline underline-offset-4 hover:text-violet-100">{integration.label}</a>
          </article>
        ))}
      </div>
      <GoogleTasksImport />
      <TodoistImport />
      <ManualTaskImport />
      <ManualCalendarImport />
      <p className="text-xs leading-5 text-slate-400">
        Antes de ativar a sincronização, configuraremos OAuth com permissões mínimas,
        armazenamento seguro de credenciais e prevenção de tarefas duplicadas.
      </p>
    </section>
  );
}
