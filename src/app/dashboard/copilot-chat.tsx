"use client";

import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import TaskConfirmation from "./task-confirmation";
import EventConfirmation from "./event-confirmation";
import type { SavedTask } from "@/lib/plan-storage";
import type { NewCalendarEvent } from "@/lib/event-cloud";

type ChatMessage = {
  id?: string;
  taskStatus?: "legacy" | "pending" | "saved" | "cancelled";
  eventStatus?: "legacy" | "pending" | "saved" | "cancelled";
  role: "user" | "assistant";
  content: string;
  proposedTask?: SavedTask | null;
  proposedTasks?: SavedTask[];
  taskDecisions?: Array<{
    taskIndex: number;
    decision: "saved" | "cancelled";
  }>;
  proposedEvent?: NewCalendarEvent | null;

};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTaskProposal(
  value: unknown
): value is Omit<SavedTask, "completed"> {
  return (
    isRecord(value) &&
    typeof value.title === "string" &&
    value.title.trim().length > 0 &&
    value.title.length <= 200 &&
    (value.priority === "Alta" ||
      value.priority === "Média" ||
      value.priority === "Normal") &&
    (typeof value.dueDate === "string" || value.dueDate === null)
  );
}

export default function CopilotChat() {
function isEventProposal(
  value: unknown
): value is NewCalendarEvent {
  if (!isRecord(value)) return false;

  if (
    typeof value.title !== "string" ||
    !value.title.trim() ||
    value.title.length > 200
  ) {
    return false;
  }

  if (
    typeof value.startsAt !== "string" ||
    typeof value.endsAt !== "string"
  ) {
    return false;
  }

  const start = new Date(value.startsAt);
  const end = new Date(value.endsAt);

  if (
    !Number.isFinite(start.getTime()) ||
    !Number.isFinite(end.getTime()) ||
    end <= start
  ) {
    return false;
  }

  return (
    (value.location === null ||
      typeof value.location === "string") &&
    (value.eventType === "appointment" ||
      value.eventType === "unavailable") &&
    typeof value.blocksTime === "boolean"
  );
}
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pendingTask, setPendingTask] = useState<SavedTask | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

const [listening, setListening] = useState(false);

const [attachment, setAttachment] = useState<File | null>(null);
const attachmentInputRef = useRef<HTMLInputElement>(null);

function handleAttachment(file?: File) {
  if (!file) return;

  const allowedTypes = [
    "application/pdf",
    "image/png",
    "image/jpeg",
    "text/plain",
  ];

  if (!allowedTypes.includes(file.type)) {
    setError("Formato de arquivo não suportado.");
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    setError("O arquivo deve ter no máximo 5 MB.");
    return;
  }

  setError("");
  setAttachment(file);
}

async function startVoice() {
  type Recognition = {
    lang: string;
    onresult: ((event: {
      results: ArrayLike<ArrayLike<{ transcript: string }>>;
    }) => void) | null;
    onend: (() => void) | null;
    onerror: (() => void) | null;
    start: () => void;
  };

  const browser = window as Window & {
    SpeechRecognition?: new () => Recognition;
    webkitSpeechRecognition?: new () => Recognition;
  };

  const SpeechAPI =
    browser.SpeechRecognition ??
    browser.webkitSpeechRecognition;

  if (!SpeechAPI) {
    setError("Seu navegador não suporta reconhecimento de voz.");
    return;
  }

  const recognition = new SpeechAPI();
  recognition.lang = "pt-BR";

  recognition.onresult = (event) => {
    const text = Array.from(event.results)
      .map((result) => result[0]?.transcript ?? "")
      .join(" ");

    setInput((previous) =>
      [previous, text].filter(Boolean).join(" ").slice(0, 1500)
    );
  };

  recognition.onend = () => setListening(false);

  recognition.onerror = () => {
    setListening(false);
    setError("Não foi possível reconhecer sua voz.");
  };

  try {
    setError("");
    recognition.start();
    setListening(true);
  } catch {
    setListening(false);
    setError("Não foi possível iniciar o microfone.");
  }
}

  useEffect(() => {
    let active = true;

    async function loadHistory() {
      try {
        const response = await fetch("/api/myka/history", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Nao foi possivel carregar o historico da Myka.");
        }

        const data: unknown = await response.json();

        if (
          !isRecord(data) ||
          !Array.isArray(data.messages) ||
          (
            data.conversationId !== null &&
            typeof data.conversationId !== "string"
          )
        ) {
          throw new Error("Historico da Myka invalido.");
        }

        const restored: ChatMessage[] = data.messages
          .filter(
            (item): item is Record<string, unknown> =>
              isRecord(item) &&
              (item.role === "user" || item.role === "assistant") &&
              typeof item.content === "string"
          )
          .map((item) => ({
            id: typeof item.id === "string" ? item.id : undefined,
            role: item.role as "user" | "assistant",
            content: item.content as string,
            taskStatus: item.taskStatus === "saved" || item.taskStatus === "cancelled" || item.taskStatus === "pending" ? item.taskStatus : "legacy",
            eventStatus: item.eventStatus === "saved" || item.eventStatus === "cancelled" || item.eventStatus === "pending" ? item.eventStatus : "legacy",
            taskDecisions: Array.isArray(item.taskDecisions)
              ? item.taskDecisions
                  .filter(
                    (decision): decision is Record<string, unknown> =>
                      isRecord(decision) &&
                      Number.isInteger(decision.taskIndex) &&
                      typeof decision.taskIndex === "number" &&
                      decision.taskIndex >= 0 &&
                      decision.taskIndex < 10 &&
                      (decision.decision === "saved" ||
                        decision.decision === "cancelled")
                  )
                  .map((decision) => ({
                    taskIndex: decision.taskIndex as number,
                    decision: decision.decision as "saved" | "cancelled",
                  }))
              : [],
            proposedTasks: Array.isArray(item.proposedTasks)
              ? item.proposedTasks
                  .filter(isTaskProposal)
                  .slice(0, 10)
                  .map((task) => ({
                    ...task,
                    completed: false,
                  }))
              : [],
            proposedTask: isTaskProposal(item.proposedTask)
              ? { ...item.proposedTask, completed: false }
              : null,
            proposedEvent: isEventProposal(item.proposedEvent)
              ? item.proposedEvent
              : null,
          }));

        if (active) {
          setConversationId(data.conversationId);
          setMessages(restored);
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Falha ao recuperar conversas."
          );
        }
      } finally {
        if (active) {
          setHistoryLoading(false);
        }
      }
    }

    void loadHistory();

    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages, loading]);

  async function prepareTask() {
    const content = input.trim();

    if (!content || loading) return;

    setLoading(true);
    setError("");
    setPendingTask(null);

    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: content }),
      });

      const data: unknown = await response.json();

      if (!response.ok) {
        throw new Error(
          isRecord(data) && typeof data.error === "string"
            ? data.error
            : "Não foi possível preparar a tarefa."
        );
      }

      if (
        !isRecord(data) ||
        !Array.isArray(data.tasks) ||
        data.tasks.length !== 1
      ) {
        throw new Error(
          "A solicitação precisa gerar exatamente uma tarefa."
        );
      }

      const candidate: unknown = data.tasks[0];

      if (
        !isRecord(candidate) ||
        typeof candidate.title !== "string" ||
        !candidate.title.trim() ||
        !["Alta", "Média", "Normal"].includes(
          String(candidate.priority)
        ) ||
        !(
          candidate.dueDate === null ||
          typeof candidate.dueDate === "string"
        )
      ) {
        throw new Error("A IA retornou uma tarefa inválida.");
      }

      setPendingTask({
        title: candidate.title,
        priority: candidate.priority as SavedTask["priority"],
        dueDate: candidate.dueDate as string | null,
        completed: false,
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erro ao preparar a tarefa."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const content = input.trim();

    if ((!content && !attachment) || loading || historyLoading || error) return;

    if (attachment) {
      setLoading(true);
      setError("");
      const selectedFile = attachment;
      try {
        const formData = new FormData();
        formData.append("file", selectedFile);
        if (conversationId) formData.append("conversationId", conversationId);
        formData.append("question", content || "Analise este arquivo e apresente um resumo objetivo.");
        const response = await fetch("/api/myka/analyze-file", {
          method: "POST",
          body: formData,
        });
        const result: unknown = await response.json();
        if (!response.ok) {
          throw new Error(isRecord(result) && typeof result.error === "string"
            ? result.error : "NÃ£o foi possÃ­vel analisar o arquivo.");
        }
        if (!isRecord(result) || typeof result.analysis !== "string" || typeof result.conversationId !== "string") {
          throw new Error("Resposta invÃ¡lida da anÃ¡lise de arquivo.");
        }
        setConversationId(result.conversationId as string);
        setMessages((previous) => [...previous,
          { role: "user", content: content ? `${content} (anexo: ${selectedFile.name})` : `Analise o anexo: ${selectedFile.name}` },
          { role: "assistant", content: result.analysis as string },
        ]);
        setAttachment(null);
        setInput("");
        if (attachmentInputRef.current) attachmentInputRef.current.value = "";
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao analisar arquivo.");
      } finally {
        setLoading(false);
      }
      return;
    }

    const nextMessages: ChatMessage[] = [
      ...messages,
      { role: "user" as const, content },
    ];

    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/concierge", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: nextMessages.slice(-12),
          conversationId: conversationId ?? undefined,
        }),
      });

      let data: unknown;

      try {
        data = await response.json();
      } catch {
        throw new Error("O servidor retornou uma resposta inválida.");
      }

      if (!response.ok) {
        throw new Error(
          isRecord(data) && typeof data.error === "string"
            ? data.error
            : "Não foi possível enviar a mensagem."
        );
      }

      if (!isRecord(data) || typeof data.reply !== "string") {
        throw new Error("Resposta inválida da Myka.");
      }

      if (
        !("proposedTask" in data) ||
        (data.proposedTask !== null && !isTaskProposal(data.proposedTask))
      ) {
        throw new Error("A tarefa sugerida pelo Concierge é inválida.");
      }

    const proposedTasks =
      Array.isArray(data.proposedTasks) &&
      data.proposedTasks.length <= 10 &&
      data.proposedTasks.every(isTaskProposal)
        ? data.proposedTasks.map((task) => ({
            ...task,
            completed: false,
          }))
        : [];

    const proposedTask =
  data.proposedTask === null
    ? undefined
    : { ...data.proposedTask, completed: false };

if (
  !("proposedEvent" in data) ||
  (data.proposedEvent !== null &&
    !isEventProposal(data.proposedEvent))
) {
  throw new Error("O evento sugerido pela MYRYRA e invalido.");
}

const proposedEvent =
  data.proposedEvent === null
    ? undefined
    : data.proposedEvent;

const reply = data.reply;

if (typeof data.messageId !== "string") {
  throw new Error("O servidor nao retornou o ID da mensagem.");
}
const assistantMessageId: string = data.messageId;

if (typeof data.conversationId !== "string") {
  throw new Error("O servidor nao retornou o identificador da conversa.");
}

setConversationId(data.conversationId);

      setMessages((previous): ChatMessage[] =>
  [
    ...previous,
    {
      role: "assistant" as const,
      id: assistantMessageId,
      taskStatus: (proposedTask || proposedTasks.length > 0) ? "pending" as const : "legacy" as const,
      eventStatus: proposedEvent ? "pending" as const : "legacy" as const,
      content: reply,
      ...(proposedTask ? { proposedTask } : {}), ...(proposedTasks.length ? { proposedTasks } : {}),
      ...(proposedEvent ? { proposedEvent } : {}),
    },
  ]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erro ao conversar com a Myka."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-2xl border border-violet-400/20 bg-gradient-to-b from-slate-900 to-slate-950 p-5 text-white shadow-xl shadow-violet-950/20 sm:p-7">
      <div className="mb-4">
        <p className="text-sm font-semibold text-violet-400">
          Myka AI
        </p>

        <h2 className="text-2xl font-bold">
          Converse com seu assistente
        </h2>

        <p className="mt-2 text-sm text-slate-400">
          Organize tarefas, defina prioridades e planeje seu dia conversando
          com a inteligência artificial.
        </p>
      </div>

      <div
        className="mb-5 min-h-[320px] max-h-[580px] space-y-5 overflow-y-auto rounded-2xl border border-white/10 bg-slate-950/80 p-3 sm:p-5"
        aria-live="polite"
      >
        {historyLoading && (
          <p className="text-sm text-violet-300">Carregando historico...</p>
        )}
        {!historyLoading && messages.length === 0 && (
          <div className="space-y-3 text-sm text-slate-400">
            <p>Olá! Sou a Myka.</p>
            <p>Experimente perguntar:</p>

            <ul className="list-disc space-y-2 pl-5">
              <li>Quais são minhas prioridades hoje?</li>
              <li>Tenho quatro horas. Como organizar meu dia?</li>
              <li>Quais tarefas devo executar primeiro?</li>
              <li>Como posso distribuir minhas atividades?</li>
            </ul>
          </div>
        )}

        {messages.map((message, index) => (
          <div key={index} className="space-y-3">
            <div className={message.role === "assistant" ? "flex items-start gap-3" : ""}>
              {message.role === "assistant" && (
                <img
                  src="/myka-avatar.png"
                  alt=""
                  className="h-9 w-9 shrink-0 rounded-full border border-violet-400/40 bg-slate-900 object-cover"
                />
              )}
              <div
                className={
                  message.role === "user"
                  ? "ml-auto max-w-[88%] rounded-2xl rounded-br-md border border-violet-400/20 bg-violet-700/80 p-4 shadow-md sm:max-w-[78%]"
                  : "mr-auto max-w-[88%] rounded-2xl rounded-bl-md border border-white/10 bg-slate-800/90 p-4 shadow-md sm:max-w-[78%]"
              }
            >
              <p className="mb-1 text-xs font-semibold">
                {message.role === "user" ? "Você" : "Myka"}
              </p>

              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                {message.content}
              </p>
            </div>
            </div>

                        {message.role === "assistant" &&
  Array.isArray(message.proposedTasks) &&
  message.proposedTasks.length > 0 && (
    <div className="mt-3 space-y-3">
      <p className="text-sm font-semibold text-violet-300">
        {message.proposedTasks.length} tarefa(s) identificada(s) pela Myka
      </p>

      {message.proposedTasks.map((task, taskIndex) => (
        <div key={`${message.id ?? "myka"}-${taskIndex}`}>
          {message.taskDecisions?.some(
            (item) =>
              item.taskIndex === taskIndex &&
              item.decision === "saved"
          ) ? (
            <div role="status" className="rounded-xl border border-green-500/30 bg-slate-800 p-4">
              <p className="font-semibold text-white">{task.title}</p>
              <p className="mt-2 text-sm text-green-400">
                Tarefa salva com sucesso!
              </p>
            </div>
          ) : message.taskDecisions?.some(
            (item) =>
              item.taskIndex === taskIndex &&
              item.decision === "cancelled"
          ) ? (
            <div className="rounded-xl border border-slate-600 bg-slate-800 p-4">
              <p className="font-semibold text-white">{task.title}</p>
              <p className="mt-2 text-sm text-slate-400">
                Sugestão descartada.
              </p>
            </div>
          ) : message.taskStatus === "pending" && message.id ? (
            <TaskConfirmation
              task={task}
              messageId={message.id}
              taskIndex={taskIndex}
              onSaved={() => {
                setMessages((previous) =>
                  previous.map((item) =>
                    item.id === message.id
                      ? {
                          ...item,
                          taskDecisions: [
                            ...(item.taskDecisions ?? []).filter(
                              (decision) => decision.taskIndex !== taskIndex
                            ),
                            { taskIndex, decision: "saved" as const },
                          ],
                        }
                      : item
                  )
                );
                router.refresh();
              }}
              onCancel={() => {
                setMessages((previous) =>
                  previous.map((item) =>
                    item.id === message.id
                      ? {
                          ...item,
                          taskDecisions: [
                            ...(item.taskDecisions ?? []).filter(
                              (decision) => decision.taskIndex !== taskIndex
                            ),
                            { taskIndex, decision: "cancelled" as const },
                          ],
                        }
                      : item
                  )
                );
              }}
            />
          ) : (
            <div className="rounded-xl border border-violet-500/30 bg-slate-800 p-4">
              <p className="text-xs font-semibold text-violet-400">
                Tarefa {taskIndex + 1}
              </p>
              <h3 className="mt-1 font-semibold text-white">
                {task.title}
              </h3>
              <p className="mt-2 text-sm text-slate-300">
                Prioridade: {task.priority}
              </p>
              <p className="text-sm text-slate-300">
                Prazo: {task.dueDate ?? "Não definido"}
              </p>
              <p className="mt-2 text-xs text-slate-400">
                {message.taskStatus === "legacy"
                  ? "Sugestão anterior à atualização. Confirmação indisponível."
                  : "Confirmação indisponível para esta sugestão."}
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  )}
{message.role === "assistant" && (!message.proposedTasks || message.proposedTasks.length === 0) && message.proposedTask && message.taskStatus === "saved" && (
  <p role="status" className="mt-3 text-sm text-green-400">
    Tarefa salva com sucesso!
  </p>
)}
{message.role === "assistant" && (!message.proposedTasks || message.proposedTasks.length === 0) && message.proposedTask && message.taskStatus === "cancelled" && (
  <p className="mt-3 text-sm text-slate-400">
    Sugestão cancelada.
  </p>
)}
{message.role === "assistant" && (!message.proposedTasks || message.proposedTasks.length === 0) && message.proposedTask && message.taskStatus === "legacy" && (
  <p className="mt-3 text-sm text-slate-400">
    Sugestão anterior à atualização. Confirmação indisponível para evitar duplicidade.
  </p>
)}
{message.role === "assistant" && (!message.proposedTasks || message.proposedTasks.length === 0) && message.proposedTask && message.taskStatus === "pending" && (
              <TaskConfirmation
                task={message.proposedTask}
                messageId={message.id}
                onSaved={() => {
                  setMessages((previous) =>
                    previous.map((item) =>
                      item.id === message.id
                        ? { ...item, taskStatus: "saved" as const }
                        : item
                    )
                  );
                  router.refresh();
                }}
                onCancel={async () => {
                  if (!message.id) {
                    setError("Identificador da mensagem indisponível.");
                    return;
                  }

                  try {
                    const response = await fetch("/api/myka/proposal", {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        messageId: message.id,
                        kind: "task",
                      }),
                    });

                    if (!response.ok) {
                      throw new Error(
                        "Não foi possível cancelar a sugestão no servidor."
                      );
                    }

                    setMessages((previous) =>
                      previous.map((item) =>
                        item.id === message.id
                          ? { ...item, taskStatus: "cancelled" as const }
                          : item
                      )
                    );
                  } catch (err) {
                    setError(
                      err instanceof Error
                        ? err.message
                        : "Falha ao cancelar sugestão."
                    );
                  }
                }}
              />
            )}
            {message.role === "assistant" && message.proposedEvent && (
              <EventConfirmation
                event={message.proposedEvent}
               onSaved={() => {
  window.dispatchEvent(new Event("vyra:events-updated"));
  router.refresh();
}}

                onCancel={() =>
                  setMessages((previous) =>
                    previous.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, proposedEvent: null }
                        : item
                    )
                  )
                }
              />
            )}
          </div>
        ))}

        {loading && (
          <p className="animate-pulse text-sm font-medium text-violet-300 motion-reduce:animate-none">
            Myka está analisando suas tarefas...
          </p>
        )}

        <div ref={bottomRef} />
      </div>

      {error && (
        <p role="alert" className="mb-3 text-sm text-red-400">
          {error}
        </p>
      )}

      {attachment && (
        <div className="mb-3 flex items-center gap-2 text-sm text-violet-200">
          <span className="truncate">ðŸ“Ž {attachment.name}</span>
          <button type="button" onClick={() => {
            setAttachment(null);
            if (attachmentInputRef.current) attachmentInputRef.current.value = "";
          }} aria-label="Remover anexo" className="rounded border border-white/20 px-2 py-1">
            Remover
          </button>
        </div>
      )}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          maxLength={1500}
          placeholder="Pergunte algo à Myka..."
          aria-label="Mensagem para a Myka"
          className="min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-800/80 px-4 py-3 text-white outline-none transition focus:border-violet-400/60 focus:ring-2 focus:ring-violet-500/20"
        />

<input
  ref={attachmentInputRef}
  type="file"
  accept=".pdf,.png,.jpg,.jpeg,.txt"
  className="hidden"
  onChange={(event) =>
    handleAttachment(event.target.files?.[0])
  }
/>

<button
  type="button"
  onClick={() => attachmentInputRef.current?.click()}
  className="rounded-xl border border-violet-500 px-4 py-3 text-violet-200"
  aria-label="Anexar arquivo"
>
  📎
</button>

        <button
  type="button"
  onClick={startVoice}
  disabled={listening || loading}
  className="rounded-xl border border-violet-500 px-4 py-3 text-violet-200 disabled:opacity-50"
>
  {listening ? "🎙 Ouvindo..." : "🎙 Voz"}
</button>
        <button
          type="submit"
          disabled={loading || historyLoading || !!error || (!input.trim() && !attachment)}
          className="rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-3 font-semibold text-white shadow-lg shadow-violet-900/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Enviando..." : "Enviar"}
        </button>
      </form>

      <div className="mt-3">
        <button
          type="button"
          onClick={prepareTask}
          disabled={loading || historyLoading || !!error || !input.trim()}
          className="rounded-lg border border-violet-500 px-4 py-2 text-sm font-semibold text-violet-300 disabled:opacity-50"
        >
          Preparar tarefa com IA
        </button>
      </div>


      {pendingTask && (
        <div className="mt-4">
          <TaskConfirmation
            task={pendingTask}
            onSaved={() => {
              setPendingTask(null);
              setInput("");
              router.refresh();
            }}
            onCancel={() => setPendingTask(null)}
          />
        </div>
      )}
    </section>
  );
}
