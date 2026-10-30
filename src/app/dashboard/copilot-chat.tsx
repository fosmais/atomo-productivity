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
