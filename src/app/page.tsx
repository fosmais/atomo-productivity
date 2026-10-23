"use client";

import { useState } from "react";

type Priority = "Alta" | "Média" | "Normal";

type Task = {
  title: string;
  priority: Priority;
  dueDate: string | null;
};

type DisplayTask = Task & {
  id: number;
  completed: boolean;
};

const exampleText =
  "Preparar apresentação para diretoria até sexta-feira. Revisar orçamento do projeto. Agendar reunião com a equipe. Enviar relatório de resultados.";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTask(value: unknown): value is Task {
  return (
    isRecord(value) &&
    typeof value.title === "string" &&
    value.title.trim().length > 0 &&
    (value.priority === "Alta" ||
      value.priority === "Média" ||
      value.priority === "Normal") &&
    (typeof value.dueDate === "string" || value.dueDate === null)
  );
}

function priorityStyle(priority: Priority) {
  if (priority === "Alta") {
    return "bg-red-50 text-red-700 border-red-200";
  }
  if (priority === "Média") {
    return "bg-amber-50 text-amber-700 border-amber-200";
  }
  return "bg-slate-100 text-slate-700 border-slate-200";
}

export default function Home() {
  const [text, setText] = useState("");
  const [tasks, setTasks] = useState<DisplayTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const completed = tasks.filter((task) => task.completed).length;
  const progress =
    tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0;

  async function generateTasks() {
    if (loading) return;

    if (!text.trim()) {
      setError("Digite suas anotações antes de gerar o plano.");
      return;
    }

    if (text.trim().length < 5 || text.length > 5000) {
      setError("O texto deve conter entre 5 e 5000 caracteres.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");
    setTasks([]);

    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
        },
        body: JSON.stringify({ text: text.trim() }),
      });
      let data: unknown;

      try {
        data = await response.json();
      } catch {
        throw new Error("A API retornou uma resposta inválida.");
      }

      if (!response.ok) {
        const description =
          isRecord(data) && typeof data.error === "string"
            ? data.error
            : "Não foi possível gerar o plano de ação.";
        throw new Error(description);
      }

      if (
        !isRecord(data) ||
        !Array.isArray(data.tasks) ||
        !data.tasks.every(isTask)
      ) {
        throw new Error("A API retornou um formato inesperado.");
      }

      const generated: DisplayTask[] = data.tasks.slice(0, 15).map((task, index) => ({
        ...task,
        id: index + 1,
        title: task.title.trim(),
        dueDate: task.dueDate?.trim() || null,
        completed: false,
      }));

      if (generated.length === 0) {
        throw new Error("Nenhuma tarefa válida foi encontrada.");
      }

      setTasks(generated);
      setMessage(`${generated.length} tarefas geradas com sucesso.`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Ocorreu um erro inesperado. Tente novamente."
      );
    } finally {
      setLoading(false);
    }
  }

  function toggleTask(id: number) {
    setTasks((current) =>
      current.map((task) =>
        task.id === id ? { ...task, completed: !task.completed } : task
      )
    );
  }

  async function copyTasks() {
    const content = tasks
      .map(
        (task) =>
          `${task.completed ? "[x]" : "[ ]"} ${task.title} | ` +
          `Prioridade: ${task.priority} | ` +
          `Prazo: ${task.dueDate ?? "Não definido"}`
      )
      .join("\n");

    try {
      await navigator.clipboard.writeText(content);
      setMessage("Plano copiado para a área de transferência.");
    } catch {
      setError("Não foi possível copiar. Verifique as permissões do navegador.");
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
          <div className="text-xl font-bold">
            <span className="text-teal-600">✦</span> Átomo Productivity
          </div>
          <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700">
            Beta com IA
          </span>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-5 py-14">
        <div className="mb-10 text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-teal-700">
            Seu assistente de produtividade
          </p>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl">
            Menos anotações.
            <span className="block text-teal-600">Mais execução.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600">
            Transforme ideias, reuniões e textos em um plano de ação
            organizado com inteligência artificial.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold">Suas anotações</h2>
            <p className="mt-2 text-sm text-slate-500">
              Escreva o que precisa organizar. A IA identificará tarefas,
              prioridades e possíveis prazos.
            </p>

            <label htmlFor="notes" className="mt-6 block text-sm font-semibold">
              Texto para organizar
            </label>

            <textarea
              id="notes"
              value={text}
              maxLength={5000}
              disabled={loading}
              onChange={(event) => {
                setText(event.target.value);
                setError("");
                setMessage("");
                setTasks([]);
              }}
              placeholder="Cole suas anotações aqui..."
              className="mt-2 h-64 w-full resize-y rounded-xl border border-slate-300 p-4 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100 disabled:opacity-50"
            />

            <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
              <span>Evite inserir informações confidenciais.</span>
              <span>{text.length}/5000</span>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={generateTasks}
                disabled={loading || !text.trim()}
                className="rounded-xl bg-teal-600 px-6 py-3 font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Gerando com IA..." : "✦ Gerar plano com IA"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setText(exampleText);
                  setTasks([]);
                  setError("");
                  setMessage("");
                }}
                disabled={loading}
                className="rounded-xl border border-slate-300 px-5 py-3 font-semibold hover:bg-slate-50 disabled:opacity-50"
              >
                Usar exemplo
              </button>
            </div>

            {error && (
              <div
                role="alert"
                className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700"
              >
                {error}
              </div>
            )}

            {message && !error && (
              <div
                role="status"
                className="mt-5 rounded-xl bg-teal-50 p-4 text-sm text-teal-800"
              >
                {message}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">Seu plano de ação</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {tasks.length} tarefas identificadas
                </p>
              </div>

              {tasks.length > 0 && (
                <button
                  type="button"
                  onClick={copyTasks}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50"
                >
                  Copiar plano
                </button>
              )}
            </div>

            {tasks.length > 0 && (
              <div className="mt-6">
                <div className="mb-2 flex justify-between text-sm">
                  <span className="font-medium">Progresso</span>
                  <span>
                    {completed}/{tasks.length} concluídas
                  </span>
                </div>
                <div
                  role="progressbar"
                  aria-valuenow={progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Progresso das tarefas"
                  className="h-2 overflow-hidden rounded-full bg-slate-200"
                >
                  <div
                    className="h-full rounded-full bg-teal-600 transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            <div className="mt-6 space-y-3" aria-busy={loading}>
              {loading && (
                <div
                  role="status"
                  className="rounded-xl bg-teal-50 p-6 text-center text-teal-800"
                >
                  A inteligência artificial está organizando suas tarefas...
                </div>
              )}

              {!loading && tasks.length === 0 && (
                <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 p-6 text-center">
                  <div className="mb-4 text-5xl">✦</div>
                  <p className="font-semibold">Seu plano aparecerá aqui.</p>
                  <p className="mt-2 text-sm text-slate-500">
                    Insira suas anotações e clique em Gerar plano com IA.
                  </p>
                </div>
              )}

              {tasks.map((task) => (
                <article
                  key={task.id}
                  className="rounded-xl border border-slate-200 p-4 transition hover:border-teal-300"
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={task.completed}
                      onChange={() => toggleTask(task.id)}
                      aria-label={`Concluir ${task.title}`}
                      className="mt-1 h-5 w-5 accent-teal-600"
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className={`font-semibold ${
                          task.completed
                            ? "text-slate-400 line-through"
                            : "text-slate-900"
                        }`}
                      >
                        {task.title}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-semibold ${priorityStyle(
                            task.priority
                          )}`}
                        >
                          {task.priority}
                        </span>
                        <span className="text-xs text-slate-500">
                          Prazo: {task.dueDate ?? "Não definido"}
                        </span>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-3">
          {[
            ["01", "Cole", "Insira ideias, anotações ou resumos de reuniões."],
            ["02", "Organize", "A IA transforma o conteúdo em tarefas práticas."],
            ["03", "Execute", "Acompanhe o progresso e conclua suas atividades."],
          ].map(([number, title, description]) => (
            <div
              key={number}
              className="rounded-2xl border border-slate-200 bg-white p-6"
            >
              <span className="text-sm font-bold text-teal-600">{number}</span>
              <h3 className="mt-3 text-lg font-bold">{title}</h3>
              <p className="mt-2 text-sm text-slate-600">{description}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white px-5 py-6 text-center text-sm text-slate-500">
        © {new Date().getFullYear()} Átomo Productivity — Versão Beta
      </footer>
    </main>
  );
}
