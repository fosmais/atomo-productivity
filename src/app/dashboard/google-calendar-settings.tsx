"use client";

import { useEffect, useState } from "react";
import {
  getGoogleCalendarPreferences,
  saveGoogleCalendarPreferences,
} from "@/lib/google-calendar-preferences";

type GoogleCalendar = {
  id: string;
  name: string;
  primary: boolean;
  googleSelected: boolean;
  timeZone: string | null;
};

export default function GoogleCalendarSettings() {
  const [calendars, setCalendars] = useState<GoogleCalendar[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [reconnectRequired, setReconnectRequired] = useState(false);

  useEffect(() => {
    const status = new URLSearchParams(window.location.search).get("google_calendar");
    if (!status) return;
    const messages: Record<string, string> = {
      denied: "A conexão foi cancelada ou recusada no Google. Tente novamente e autorize o acesso aos calendários.",
      invalid_state: "A validação de segurança expirou. Inicie a conexão novamente nesta mesma aba.",
      unauthorized: "Sua sessão mudou durante a conexão. Faça login novamente e tente conectar o calendário.",
      auth_error: "Não foi possível validar a sessão. Atualize a página e tente novamente.",
      mfa_required: "Conclua a verificação de dois fatores antes de conectar o calendário.",
      missing_tokens: "O Google não retornou todas as permissões necessárias. Clique em Reconectar e autorize novamente.",
      save_error: "O Google autorizou a conexão, mas não foi possível salvá-la. Tente novamente.",
      connection_error: "Não foi possível concluir a conexão. Verifique as permissões do Google e tente novamente.",
    };
    if (status === "connected") {
      setMessage("Google Calendar conectado com sucesso. Selecione os calendários que devem bloquear horários.");
    } else if (messages[status]) {
      setError(messages[status]);
    }
    // Remove the one-time callback status without reloading or repeating it.
    const url = new URL(window.location.href);
    url.searchParams.delete("google_calendar");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  }, []);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const response = await fetch("/api/google/events", {
          cache: "no-store",
        });

        if (!response.ok) {
          const result: { code?: string; error?: string } = await response.json().catch(() => ({}));
          if (response.status === 409 && result.code === "GOOGLE_CALENDAR_RECONNECT_REQUIRED") {
            if (active) {
              setReconnectRequired(true);
              setConnected(false);
              setError("Sua autorização do Google Calendar precisa ser renovada. Clique em Reconectar para recuperar a integração.");
            }
            return;
          }
          if (response.status === 401) throw new Error("Sua sessão expirou. Entre novamente para acessar os calendários.");
          if (response.status === 403 && result.code === "MFA_REQUIRED") throw new Error("Conclua a verificação de dois fatores para acessar seus calendários.");
          throw new Error(result.error || "Falha ao consultar calendários Google.");
        }

        const data: {
          connected: boolean;
          calendars?: GoogleCalendar[];
        } = await response.json();

        if (!active) return;

        setConnected(data.connected);
        setReconnectRequired(false);

        if (!data.connected) return;

        if (!Array.isArray(data.calendars)) {
          throw new Error("Lista de calendários indisponível.");
        }

        const preferences = await getGoogleCalendarPreferences();

        if (!active) return;

        setCalendars(data.calendars);

        setSelectedIds(
          preferences.selectedCalendarIds ??
            data.calendars
              .filter((calendar) => calendar.googleSelected)
              .map((calendar) => calendar.id)
        );
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Erro ao carregar calendários."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, []);

  function connectCalendar() {
    if (connecting) return;
    setConnecting(true);
    window.location.assign("/api/google/connect");
  }

  async function disconnectCalendar() {
    if (disconnecting || saving || !window.confirm("Desconectar o Google Calendar da MYRYRA? Seus calendários deixarão de ser consultados.")) return;
    setDisconnecting(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/google/disconnect", { method: "POST", credentials: "same-origin", cache: "no-store" });
      if (!response.ok) throw new Error("Não foi possível desconectar o Google Calendar.");
      setConnected(false);
      setReconnectRequired(false);
      setCalendars([]);
      setSelectedIds([]);
      setMessage("Google Calendar desconectado da MYRYRA.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao desconectar.");
    } finally {
      setDisconnecting(false);
    }
  }

  function toggleCalendar(id: string) {
    setMessage("");

    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id]
    );
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      await saveGoogleCalendarPreferences(selectedIds);
      setMessage("Seleção de calendários salva com sucesso!");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível salvar os calendários."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-xl border border-slate-700 bg-slate-900 p-6 text-white">
      <p className="text-sm font-semibold text-violet-400">
        MYRYRA CALENDAR
      </p>

      <h2 className="mt-1 text-xl font-bold">
        Calendários que influenciam meu planejamento
      </h2>

      <p className="mt-2 text-sm text-slate-400">
        Escolha quais calendários Google deverão bloquear horários
        nas sugestões inteligentes da MYRYRA.
      </p>

      {loading ? (
        <p className="mt-5 text-sm text-slate-400">
          Carregando calendários...
        </p>
      ) : !connected ? (
        <div className="mt-5 space-y-3">
          <p className="text-sm text-slate-400">
            Autorize separadamente o acesso de leitura aos seus calendários Google.
            Entrar com Google não concede essa permissão automaticamente.
          </p>
          <button
            type="button"
            onClick={connectCalendar}
            disabled={connecting}
            className="rounded-lg bg-violet-600 px-5 py-3 font-semibold text-white transition hover:bg-violet-500 disabled:opacity-50"
          >
            {connecting ? "Conectando..." : reconnectRequired ? "Reconectar Google Calendar" : "Conectar Google Calendar"}
          </button>
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-violet-500/30 bg-violet-500/10 p-3">
            <span className="text-sm text-emerald-300">Google Calendar conectado</span>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={connectCalendar} disabled={connecting || disconnecting} className="rounded-lg border border-violet-400/60 px-4 py-2 text-sm font-semibold text-violet-200 hover:bg-violet-500/20 disabled:opacity-50">
                {connecting ? "Conectando..." : "Reconectar"}
              </button>
              <button type="button" onClick={disconnectCalendar} disabled={disconnecting || connecting || saving} className="rounded-lg border border-rose-400/50 px-4 py-2 text-sm font-semibold text-rose-200 hover:bg-rose-500/10 disabled:opacity-50">
                {disconnecting ? "Desconectando..." : "Desconectar"}
              </button>
            </div>
          </div>
          {calendars.map((calendar) => (
            <label
              key={calendar.id}
              className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-slate-700 bg-slate-800 p-4"
            >
              <span>
                <span className="block font-medium">
                  {calendar.name}
                  {calendar.primary ? " (principal)" : ""}
                </span>
                <span className="block text-xs text-slate-400">
                  {calendar.timeZone ?? "Fuso não informado"}
                </span>
              </span>

              <input
                type="checkbox"
                checked={selectedIds.includes(calendar.id)}
                onChange={() => toggleCalendar(calendar.id)}
                disabled={saving}
                className="h-5 w-5 accent-violet-500"
              />
            </label>
          ))}

          <p className="text-sm text-slate-400">
            {selectedIds.length} calendário(s) selecionado(s).
          </p>

          {selectedIds.length === 0 && (
            <p className="text-sm text-amber-400">
              Atenção: nenhum calendário Google bloqueará horários
              quando essa seleção for ativada no planejamento.
            </p>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={saving || calendars.length === 0}
            className="rounded-lg bg-violet-600 px-5 py-3 font-semibold hover:bg-violet-500 disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Salvar calendários"}
          </button>
        </div>
      )}

      {message && (
        <p role="status" className="mt-4 text-sm text-emerald-400">
          {message}
        </p>
      )}

      {error && (
        <p role="alert" className="mt-4 text-sm text-red-400">
          {error}
        </p>
      )}
    </section>
  );
}
