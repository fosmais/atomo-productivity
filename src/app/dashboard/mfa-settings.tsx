"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function MfaSettings() {
  const [factorId, setFactorId] = useState("");
  const [qr, setQr] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function begin() {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const supabase = createClient();
      const factors = await supabase.auth.mfa.listFactors();
      if (factors.error) throw factors.error;
      const verified = factors.data.totp.filter((factor) => factor.status === "verified");
      if (verified.length > 0) {
        const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (assurance.error) throw assurance.error;
        if (assurance.data.currentLevel !== "aal2") {
          throw new Error("Confirme o segundo fator atual antes de cadastrar outro dispositivo.");
        }
      }
      const result = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "MYRYRA autenticador adicional" });
      if (result.error) throw result.error;
      setCode("");
      setFactorId(result.data.id);
      setQr(result.data.totp.qr_code);
      setSecret(result.data.totp.secret);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível iniciar a configuração.");
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (busy || !factorId || !/^\d{6}$/.test(code)) return;
    setBusy(true);
    setError("");
    try {
      const supabase = createClient();
      const challenge = await supabase.auth.mfa.challenge({ factorId });
      if (challenge.error) throw challenge.error;
      const verified = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.data.id, code });
      if (verified.error) throw verified.error;
      setFactorId("");
      setQr("");
      setSecret("");
      setCode("");
      setMessage("Autenticador verificado e ativado com sucesso.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Código inválido.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mb-6 rounded-2xl border border-violet-500/30 bg-slate-900 p-5" aria-label="Segurança da conta">
      <h3 className="text-lg font-semibold text-white">Segurança · Autenticação em duas etapas</h3>
      <p className="mt-2 text-sm text-slate-300">Proteja sua conta com um código gerado pelo aplicativo autenticador. Se já utiliza 2FA, cadastre um segundo dispositivo para reduzir o risco de perder o acesso.</p>
      {!factorId ? (
        <button type="button" disabled={busy} onClick={() => void begin()} className="mt-4 rounded-xl bg-violet-600 px-4 py-2 font-semibold text-white disabled:opacity-50">
          {busy ? "Aguarde..." : "Adicionar autenticador"}
        </button>
      ) : (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-slate-200">Escaneie o QR code no aplicativo autenticador e informe o código de seis dígitos.</p>
          {qr && <img src={qr} alt="QR code para cadastrar o autenticador" className="h-44 w-44 rounded-xl bg-white p-2" />}
          <details className="text-sm text-slate-300"><summary>Não consegue escanear? Mostrar chave manual</summary><code className="mt-2 block break-all select-all rounded bg-slate-950 p-2">{secret}</code></details>
          <label htmlFor="totp-enroll-code" className="block text-sm">Código de verificação</label>
          <input id="totp-enroll-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} className="w-full max-w-xs rounded-xl border border-slate-700 bg-slate-950 p-3 text-white" />
          <button type="button" disabled={busy || code.length !== 6} onClick={() => void confirm()} className="block rounded-xl bg-violet-600 px-4 py-2 font-semibold text-white disabled:opacity-50">Ativar 2FA</button>
          <p className="text-xs text-amber-200">Guarde os dois autenticadores em dispositivos seguros. Perder todos os fatores pode bloquear o acesso; recuperação assistida ainda não está disponível.</p>
        </div>
      )}
      {message && <p role="status" className="mt-3 text-sm text-emerald-300">{message}</p>}
      {error && <p role="alert" className="mt-3 text-sm text-rose-300">{error}</p>}
    </section>
  );
}
