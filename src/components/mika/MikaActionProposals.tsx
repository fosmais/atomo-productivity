"use client";

import { useState } from "react";

type Action = {
  type: "create_task" | "create_event" | "create_reminder";
  title: string;
  reason: string;
  due_at: string | null;
};

export function MikaActionProposals() {
  const [request, setRequest] = useState("");
  const [actions, setActions] = useState<Action[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<number[]>([]);

  async function propose() {
    setLoading(true);
    setError("");
    setActions([]);
    setSelected([]);
    try {
      const response = await fetch("/api/mika/actions/propose", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: request })
      });
      const body: unknown = await response.json();
      if (!response.ok) throw new Error(
        body && typeof body === "object" && "error" in body && typeof body.error === "string"
          ? body.error : "Não foi possível gerar propostas."
      );
      if (!body || typeof body !== "object" || !("actions" in body) ||
          !Array.isArray(body.actions)) throw new Error("Resposta inesperada.");
      setActions(body.actions.filter((item: unknown): item is Action =>
        !!item && typeof item === "object" && "title" in item &&
        typeof item.title === "string" && "type" in item &&
        ["create_task", "create_event", "create_reminder"].includes(String(item.type))
      ));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao preparar propostas.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section aria-label="Propostas da MIKA" className="space-y-4 rounded-2xl border p-4">
      <h2 className="text-lg font-semibold">MIKA Agente</h2>
      <p className="text-sm opacity-75">Descreva o que precisa organizar. A MIKA prepara sugestões sem alterar seus dados.</p>
      <label htmlFor="mika-action-request" className="block text-sm font-medium">O que deseja organizar?</label>
      <textarea
        id="mika-action-request"
        className="w-full rounded-lg border bg-transparent p-3"
        maxLength={2000}
        rows={3}
        value={request}
        onChange={(event) => setRequest(event.target.value)}
      />
      <button type="button" onClick={propose} disabled={loading || request.trim().length < 3}
        className="rounded-lg border px-4 py-2 disabled:opacity-50">
        {loading ? "Preparando..." : "Gerar propostas"}
      </button>
      {error && <p role="alert" className="text-sm">{error}</p>}
      {actions.length > 0 && (
        <div className="space-y-3">
          <p className="font-medium">Revise as propostas</p>
          {actions.map((action, index) => (
            <label key={index} className="flex gap-3 rounded-xl border p-3">
              <input type="checkbox" checked={selected.includes(index)}
                onChange={(event) => setSelected(current => event.target.checked
                  ? [...current, index] : current.filter(value => value !== index))} />
              <span>
                <strong className="block">{action.title}</strong>
                <span className="block text-sm opacity-75">{action.reason}</span>
                {action.due_at && <span className="block text-xs opacity-75">Prazo: {action.due_at}</span>}
                <span className="block text-xs opacity-75">{action.type}</span>
              </span>
            </label>
          ))}
          <p role="status" className="text-sm">
            {selected.length} proposta(s) selecionada(s). A execução ficará disponível após a homologação do fluxo de autorização.
          </p>
          <button type="button" disabled className="rounded-lg border px-4 py-2 opacity-50">
            Executar ações selecionadas (em homologação)
          </button>
        </div>
      )}
    </section>
  );
}
