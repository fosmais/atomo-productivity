"use client";

import { useState } from "react";

type Task = {
  id: number;
  title: string;
  done: boolean;
};

export default function Home() {
  const [text, setText] = useState("");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [error, setError] = useState("");

  function generate() {
    if (!text.trim()) {
      setError("Digite suas anotações primeiro.");
      return;
    }

    const result = text
      .split(/\r?\n|[.!?]+/)
      .map((item) => item.trim())
      .filter((item) => item.length > 2)
      .slice(0, 30)
      .map((title, id) => ({
        id,
        title,
        done: false,
      }));

    setTasks(result);
    setError("");
  }

  const completed = tasks.filter((task) => task.done).length;
  const progress = tasks.length
    ? Math.round((completed / tasks.length) * 100)
    : 0;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b bg-white px-6 py-5">
        <div className="mx-auto max-w-5xl text-xl font-bold">
          <span className="text-teal-600">✦</span> Átomo Productivity
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-5 py-16">
        <div className="text-center">
          <h1 className="text-4xl font-extrabold sm:text-6xl">
            Menos anotações.
            <span className="block text-teal-600">
              Mais execução.
            </span>
          </h1>
          <p className="mt-6 text-lg text-slate-600">
            Transforme suas anotações em tarefas organizadas.
          </p>
        </div>

        <div className="mt-12 rounded-3xl border bg-white p-6 shadow-lg">
          <h2 className="text-xl font-bold">Suas anotações</h2>

          <textarea
            aria-label="Suas anotações"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setTasks([]);
              setError("");
            }}
            rows={7}
            maxLength={5000}
            placeholder="Digite suas tarefas aqui..."
            className="mt-5 w-full rounded-xl border p-4"
          />

          {error && <p className="text-red-600">{error}</p>}

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              onClick={generate}
              className="rounded-xl bg-teal-600 px-6 py-3 font-semibold text-white"
            >
              Gerar plano de ação
            </button>

            <button
              onClick={() => {
                setText("Preparar apresentação.\nRevisar orçamento.\nAgendar reunião.");
                setTasks([]);
                setError("");
              }}
              className="rounded-xl border px-6 py-3"
            >
              Usar exemplo
            </button>

            <button
              onClick={() => {
                setText("");
                setTasks([]);
                setError("");
              }}
              className="rounded-xl border px-6 py-3"
            >
              Limpar
            </button>
          </div>
          <p className="mt-5 text-xs text-slate-500">
            Protótipo local baseado em regras, ainda sem IA.
          </p>
        </div>

        {tasks.length > 0 && (
          <div className="mt-8 rounded-3xl border bg-white p-6">
            <h2 className="text-2xl font-bold">Seu plano de ação</h2>
            <p className="mt-4">Progresso: {progress}%</p>

            <div className="mt-2 h-3 rounded-full bg-slate-100">
              <div
                className="h-3 rounded-full bg-teal-500"
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className="mt-6 space-y-3">
              {tasks.map((task) => (
                <label key={task.id} className="flex gap-3 rounded-xl bg-slate-50 p-4">
                  <input
                    type="checkbox"
                    checked={task.done}
                    onChange={() =>
                      setTasks((current) =>
                        current.map((item) =>
                          item.id === task.id
                            ? { ...item, done: !item.done }
                            : item
                        )
                      )
                    }
                  />
                  <span className={task.done ? "line-through text-slate-400" : ""}>
                    {task.title}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
