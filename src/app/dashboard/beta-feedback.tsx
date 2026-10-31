"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Category = "ideia" | "problema" | "avaliacao";
export default function BetaFeedback() {
  const [category, setCategory] = useState<Category>("ideia");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = message.trim();
    if (sending || trimmed.length < 10 || trimmed.length > 1500) return;
    setSending(true); setError(""); setSuccess(false);
    try {
      const supabase = createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error("Faça login para enviar seu feedback.");
      const { error: insertError } = await supabase.from("beta_feedback").insert({ user_id: user.id, category, message: trimmed });
      if (insertError) throw insertError;
      setMessage(""); setSuccess(true);
    } catch { setError("Não foi possível enviar. Tente novamente."); }
    finally { setSending(false); }
  }
  return <section className="rounded-2xl border border-violet-500/30 bg-slate-900 p-5 text-white" aria-label="Feedback MYRYRA">
    <p className="text-xs font-semibold uppercase tracking-widest text-violet-400">MYRYRA · BETA</p>
    <h3 className="mt-2 text-xl font-semibold">Ajude a construir a próxima versão.</h3>
    <p className="mt-1 text-sm text-slate-300">Compartilhe uma ideia, relate um problema ou avalie sua experiência.</p>
    <form onSubmit={submit} className="mt-4 space-y-3">
      <label className="block text-sm text-slate-300">Tipo de feedback
        <select value={category} onChange={e => setCategory(e.target.value as Category)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white">
          <option value="ideia">Sugestão de melhoria</option><option value="problema">Reportar problema</option><option value="avaliacao">Avaliar experiência</option>
        </select>
      </label>
      <label className="block text-sm text-slate-300">Mensagem
        <textarea value={message} onChange={e => { setMessage(e.target.value); setSuccess(false); }} minLength={10} maxLength={1500} rows={4} required placeholder="Conte o que podemos melhorar..." className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white" />
      </label>
      <button type="submit" disabled={sending || message.trim().length < 10} className="rounded-xl bg-violet-600 px-5 py-3 font-semibold disabled:opacity-50">{sending ? "Enviando..." : "Enviar feedback"}</button>
    </form>
    {error && <p role="alert" className="mt-3 text-sm text-rose-300">{error}</p>}
    {success && <p role="status" className="mt-3 text-sm text-emerald-300">Feedback recebido. Obrigado por contribuir!</p>}
    <p className="mt-3 text-xs text-slate-400">Não inclua senhas, chaves ou dados sensíveis na mensagem.</p>
  </section>;
}
