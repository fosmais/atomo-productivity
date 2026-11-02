"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ChangePassword() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setMessage(""); setError("");
    if (next.length < 12) { setError("A nova senha deve ter pelo menos 12 caracteres."); return; }
    if (next !== confirm) { setError("As novas senhas não coincidem."); return; }
    if (current === next) { setError("Escolha uma senha diferente da atual."); return; }
    setBusy(true);
    try {
      const supabase = createClient();
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user?.email) throw new Error("Entre novamente na conta para alterar a senha.");
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: auth.user.email, password: current,
      });
      if (loginError) throw new Error("Senha atual incorreta ou conta sem senha. Use a recuperação de senha.");
      const { error: updateError } = await supabase.auth.updateUser({ password: next });
      if (updateError) throw updateError;
      setCurrent(""); setNext(""); setConfirm("");
      setMessage("Senha atualizada com sucesso.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível alterar a senha.");
    } finally { setBusy(false); }
  }

  return (
    <section className="mt-5 rounded-xl border border-violet-500/25 bg-slate-950/70 p-4">
      <h3 className="font-semibold text-white">Alterar senha</h3>
      <p className="mt-1 text-sm text-slate-400">Para contas com senha, confirme a senha atual antes de alterá-la. Contas Google podem usar a recuperação por e-mail.</p>
      <form onSubmit={submit} className="mt-3 space-y-3">
        <label className="block text-sm text-slate-200">Senha atual
          <input required type="password" autoComplete="current-password" value={current} onChange={e => setCurrent(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 p-3" />
        </label>
        <label className="block text-sm text-slate-200">Nova senha
          <input required minLength={12} type="password" autoComplete="new-password" value={next} onChange={e => setNext(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 p-3" />
        </label>
        <label className="block text-sm text-slate-200">Confirmar nova senha
          <input required minLength={12} type="password" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 p-3" />
        </label>
        {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
        {message && <p role="status" className="text-sm text-emerald-300">{message}</p>}
        <button disabled={busy} type="submit" className="rounded-lg bg-violet-600 px-4 py-2 font-semibold text-white disabled:opacity-50">{busy ? "Salvando..." : "Alterar senha"}</button>
      </form>
    </section>
  );
}
