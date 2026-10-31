"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [factorId, setFactorId] = useState("");
  const [factorCode, setFactorCode] = useState("");
  const [factors, setFactors] = useState<{ id: string; name: string }[]>([]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (password.length < 12) { setError("Use uma senha com pelo menos 12 caracteres."); return; }
    if (password !== confirm) { setError("As senhas não coincidem."); return; }
    setBusy(true);
    setError("");
    try {
      const supabase = createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error("Link inválido ou expirado. Solicite outro e-mail de recuperação.");
      const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assurance.error) throw new Error("Não foi possível verificar a segurança da sessão.");
      if (assurance.data.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2") {
        const available = await supabase.auth.mfa.listFactors();
        if (available.error) throw available.error;
        const verified = available.data.totp.filter((factor) => factor.status === "verified");
        setFactors(verified.map((factor) => ({ id: factor.id, name: factor.friendly_name || "Autenticador" })));
        setFactorId((current) => verified.some((factor) => factor.id === current) ? current : verified[0]?.id ?? "");
        throw new Error("Confirme seu autenticador abaixo antes de salvar a nova senha.");
      }
      const result = await supabase.auth.updateUser({ password });
      if (result.error) throw result.error;
      await supabase.auth.signOut();
      setPassword("");
      setConfirm("");
      setFactors([]);
      setFactorId("");
      setFactorCode("");
      setMessage("Senha atualizada. Faça login novamente e confirme seu segundo fator, se ativado.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível atualizar a senha.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyFactor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !factorId || !/^\d{6}$/.test(factorCode)) return;
    setBusy(true);
    setError("");
    try {
      const supabase = createClient();
      const challenge = await supabase.auth.mfa.challenge({ factorId });
      if (challenge.error) throw challenge.error;
      const result = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.data.id, code: factorCode });
      if (result.error) throw result.error;
      setFactorCode("");
      setFactors([]);
      setFactorId("");
      setMessage("Autenticador confirmado. Agora salve a nova senha.");
    } catch (err) {
      setFactorCode("");
      setError(err instanceof Error ? err.message : "Não foi possível confirmar o autenticador.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="flex min-h-screen items-center justify-center bg-[#090716] px-4 text-white">
    <section className="w-full max-w-md rounded-3xl border border-violet-500/30 bg-slate-950 p-7">
      <h1 className="text-2xl font-bold">MYRYRA · Nova senha</h1>
      <p className="mt-2 text-sm text-slate-300">Defina uma senha nova. Seu autenticador continuará necessário se o 2FA estiver ativo.</p>
      {!message.startsWith("Senha atualizada.") && <form onSubmit={submit} className="mt-6 space-y-4">
        <label className="block text-sm">Nova senha<input type="password" autoComplete="new-password" minLength={12} required value={password} onChange={e => setPassword(e.target.value)} className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 p-3" /></label>
        <label className="block text-sm">Confirmar nova senha<input type="password" autoComplete="new-password" minLength={12} required value={confirm} onChange={e => setConfirm(e.target.value)} className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 p-3" /></label>
        <button type="submit" disabled={busy} className="w-full rounded-lg bg-violet-600 p-3 font-semibold disabled:opacity-50">{busy ? "Atualizando..." : "Salvar nova senha"}</button>
      </form>}
      {factors.length > 0 && <form onSubmit={verifyFactor} className="mt-5 space-y-3 rounded-xl border border-violet-500/30 p-4">
        <p className="text-sm text-slate-200">Confirme o segundo fator para continuar a recuperação.</p>
        {factors.length > 1 && <select aria-label="Selecionar autenticador" value={factorId} onChange={e => setFactorId(e.target.value)} className="w-full rounded-lg bg-slate-900 p-3">{factors.map(factor => <option key={factor.id} value={factor.id}>{factor.name}</option>)}</select>}
        <input aria-label="Código do autenticador" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={factorCode} onChange={e => setFactorCode(e.target.value.replace(/\D/g, "").slice(0, 6))} className="w-full rounded-lg border border-slate-700 bg-slate-900 p-3" />
        <button type="submit" disabled={busy || factorCode.length !== 6} className="w-full rounded-lg bg-violet-600 p-3 disabled:opacity-50">Confirmar autenticador</button>
      </form>}
      {error && <p role="alert" className="mt-4 text-sm text-rose-300">{error}</p>}
      {message && <p role="status" className="mt-4 text-sm text-emerald-300">{message}</p>}
      <button type="button" onClick={() => router.push("/login")} className="mt-5 text-sm text-violet-300">Voltar ao login</button>
    </section>
  </main>;
}
