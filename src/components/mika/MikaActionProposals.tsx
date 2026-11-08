"use client";

import { useEffect, useState } from "react";

type Action = {
  type: "create_task" | "create_event" | "create_reminder";
  title: string;
  reason: string;
  due_at: string | null;
  proposal_id: string;
  expires_at: string;
};

type HistoryItem = {
  id: string;
  action_type: string;
  payload: { title?: string };
  status: string;
  created_at: string;
  expires_at: string;
};

export function MikaActionProposals() {
  const [legalReady, setLegalReady] = useState(false);
  const [legalMessage, setLegalMessage] = useState("Verificando os termos de uso...");
  useEffect(() => {
    let active = true;
    fetch("/api/privacy/onboarding", { credentials: "same-origin", cache: "no-store" })
      .then(async response => {
        if (!response.ok) throw new Error("Aceite legal indisponível. Consulte o suporte.");
        return response.json() as Promise<{ complete?: boolean; configured?: boolean }>;
      })
      .then(data => {
        if (!active) return;
        setLegalReady(data.complete === true);
        setLegalMessage(data.complete === true ? "" : "Os documentos legais precisam estar publicados e aceitos antes de usar a MIKA Agente.");
      })
      .catch(() => {
        if (active) setLegalMessage("Não foi possível verificar o aceite legal. Tente novamente mais tarde.");
      });
    return () => { active = false; };
  }, []);
  const [request, setRequest] = useState("");
  const [actions, setActions] = useState<Action[]>([]);
  const [loading, setLoading] = useState(false);
  const [decisionBusy, setDecisionBusy] = useState<string | null>(null);
  const [decisionMessage, setDecisionMessage] = useState("");
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");

  async function loadHistory() {
    setHistoryLoading(true);
    setHistoryError("");
    try {
      const response = await fetch("/api/mika/actions/history", {
        method: "GET", credentials: "same-origin", cache: "no-store"
      });
      if (!response.ok) throw new Error("Não foi possível carregar o histórico.");
      const body: unknown = await response.json();
      if (!body || typeof body !== "object" || !("proposals" in body) ||
          !Array.isArray(body.proposals)) throw new Error("Resposta inválida do histórico.");
      setHistory(body.proposals.filter((item: unknown): item is HistoryItem =>
        !!item && typeof item === "object" &&
        "id" in item && typeof item.id === "string" &&
        "status" in item && typeof item.status === "string" &&
        "created_at" in item && typeof item.created_at === "string"
      ));
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : "Histórico indisponível.");
    } finally {
      setHistoryLoading(false);
    }
  }

  async function propose() {
    if (!legalReady) return;
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
      setDecisionMessage("");
      setActions(body.actions.filter((item: unknown): item is Action =>
        !!item && typeof item === "object" && "title" in item &&
        typeof item.title === "string" && "type" in item &&
        ["create_task", "create_event", "create_reminder"].includes(String(item.type)) &&
        "proposal_id" in item && typeof item.proposal_id === "string" &&
        "expires_at" in item && typeof item.expires_at === "string"
      ));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao preparar propostas.");
    } finally {
      setLoading(false);
    }
  }

  async function decide(proposalId: string, approve: boolean) {
    if (decisionBusy) return;
    setDecisionBusy(proposalId);
    setError("");
    setDecisionMessage("");
    try {
      const response = await fetch("/api/mika/actions/decide", {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposalId, approve })
      });
      const result: { error?: string; status?: string } = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível registrar a decisão.");
      setActions(current => current.filter(action => action.proposal_id !== proposalId));
      setSelected(current => current.filter(id => id !== proposalId));
      setDecisionMessage(result.status === "approved"
        ? "Proposta aprovada e registrada. A execução ainda está desabilitada."
        : result.status === "expired" ? "A proposta expirou." : "Proposta rejeitada.");
      await loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao registrar decisão.");
    } finally {
      setDecisionBusy(null);
    }
  }

  return (
    <section aria-label="Propostas da MIKA" className="space-y-4 rounded-2xl border p-4">
      <h2 className="text-lg font-semibold">MIKA Agente</h2>
      <p className="text-sm opacity-75">Descreva o que precisa organizar. A MIKA prepara sugestões sem alterar seus dados.</p>
      {!legalReady && <>
        <p role="status" className="rounded-lg border p-3 text-sm">{legalMessage}</p>
        <a className="text-sm underline" href="/privacidade/primeiro-acesso">Consultar documentos e registrar aceite</a>
      </>}
      <label htmlFor="mika-action-request" className="block text-sm font-medium">O que deseja organizar?</label>
      <textarea
        id="mika-action-request"
        className="w-full rounded-lg border bg-transparent p-3"
        maxLength={2000}
        rows={3}
        value={request}
        onChange={(event) => setRequest(event.target.value)}
      />
      <button type="button" onClick={propose} disabled={!legalReady || loading || request.trim().length < 3}
        className="rounded-lg border px-4 py-2 disabled:opacity-50">
        {loading ? "Preparando..." : "Gerar propostas"}
      </button>
      {error && <p role="alert" className="text-sm">{error}</p>}
      <div className="rounded-xl border p-3 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-medium">Histórico de propostas</h3>
          <button type="button" onClick={loadHistory} disabled={historyLoading}
            className="rounded-lg border px-3 py-1 text-sm disabled:opacity-50">
            {historyLoading ? "Carregando..." : "Atualizar histórico"}
          </button>
        </div>
        {historyError && <p role="alert" className="text-sm">{historyError}</p>}
        {history.map(item => (
          <div key={item.id} className="rounded-lg border p-2 text-sm">
            <strong className="block">{item.payload?.title || item.action_type}</strong>
            <span className="opacity-75">Status: {item.status} · {new Date(item.created_at).toLocaleString("pt-BR")}</span>
          </div>
        ))}
      </div>
      {actions.length > 0 && (
        <div className="space-y-3">
          <p className="font-medium">Revise as propostas</p>
          {actions.map((action) => (
            <label key={action.proposal_id} className="flex gap-3 rounded-xl border p-3">
              <input type="checkbox" disabled={decisionBusy !== null || Date.parse(action.expires_at) <= Date.now()} checked={selected.includes(action.proposal_id)}
                onChange={(event) => setSelected(current => event.target.checked
                  ? [...current, action.proposal_id] : current.filter(value => value !== action.proposal_id))} />
              <span>
                <strong className="block">{action.title}</strong>
                <span className="block text-sm opacity-75">{action.reason}</span>
                {action.due_at && <span className="block text-xs opacity-75">Prazo: {action.due_at}</span>}
                <span className="block text-xs opacity-75">Proposta registrada · válida até {new Date(action.expires_at).toLocaleString("pt-BR")}</span>
                <span className="block text-xs opacity-75">{action.type}</span>
              </span>
            </label>
          ))}
          <p role="status" className="text-sm">
            {selected.length} proposta(s) selecionada(s). A aprovação registra sua decisão, mas não executa ações.
          </p>
          {decisionMessage && <p role="status" className="text-sm">{decisionMessage}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={decisionBusy !== null || selected.length !== 1}
              onClick={() => { if (selected.length === 1) void decide(selected[0], true); }}
              className="rounded-lg border px-4 py-2 disabled:opacity-50">
              {decisionBusy ? "Registrando..." : "Aprovar proposta selecionada"}
            </button>
            <button type="button" disabled={decisionBusy !== null || selected.length !== 1}
              onClick={() => { if (selected.length === 1) void decide(selected[0], false); }}
              className="rounded-lg border px-4 py-2 disabled:opacity-50">
              Rejeitar proposta selecionada
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
