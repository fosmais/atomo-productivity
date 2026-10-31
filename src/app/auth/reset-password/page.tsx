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
        throw new Error("Confirme seu segundo fator antes de alterar a senha. Acesse o login e conclua a verificação.");
      }
      const result = await supabase.auth.updateUser({ password });
      if (result.error) throw result.error;
      await supabase.auth.signOut();
      setPassword("");
      setConfirm("");
      setMessage("Senha atualizada. Faça login novamente e confirme seu segundo fator, se ativado.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível atualizar a senha.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="flex min-h-screen items-center justify-center bg-[#090716] px-4 text-white">
    <section className="w-full max-w-md rounded-3xl border border-violet-500/30 bg-slate-950 p-7">
      <h1 className="text-2xl font-bold">MYRYRA · Nova senha</h1>
      <p className="mt-2 text-sm text-slate-300">Defina uma senha nova. Seu autenticador continuará necessário se o 2FA estiver ativo.</p>
      {!message && <form onSubmit={submit} className="mt-6 space-y-4">
        <label className="block text-sm">Nova senha<input type="password" autoComplete="new-password" minLength={12} required value={password} onChange={e => setPassword(e.target.value)} className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 p-3" /></label>
        <label className="block text-sm">Confirmar nova senha<input type="password" autoComplete="new-password" minLength={12} required value={confirm} onChange={e => setConfirm(e.target.value)} className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 p-3" /></label>
        <button type="submit" disabled={busy} className="w-full rounded-lg bg-violet-600 p-3 font-semibold disabled:opacity-50">{busy ? "Atualizando..." : "Salvar nova senha"}</button>
      </form>}
      {error && <p role="alert" className="mt-4 text-sm text-rose-300">{error}</p>}
      {message && <p role="status" className="mt-4 text-sm text-emerald-300">{message}</p>}
      <button type="button" onClick={() => router.push("/login")} className="mt-5 text-sm text-violet-300">Voltar ao login</button>
    </section>
  </main>;
}
