"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState("");
  const [mfaCode, setMfaCode] = useState("");

  useEffect(() => {
    let active = true;
    const errorCode = new URLSearchParams(window.location.search).get("error");
    if (errorCode === "recovery") {
      setIsError(true);
      setMessage("O link de recuperação é inválido ou expirou. Solicite um novo e-mail.");
    } else if (errorCode === "confirm") {
      setIsError(true);
      setMessage("Não foi possível confirmar o link. Solicite um novo e-mail.");
    }
    async function resumeMfa() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !active) return;
        const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (assurance.error || !active) return;
        if (assurance.data.currentLevel === "aal2" || assurance.data.nextLevel === "aal1") {
          router.replace("/dashboard");
          router.refresh();
          return;
        }
        if (assurance.data.nextLevel === "aal2") {
          const factors = await supabase.auth.mfa.listFactors();
          if (factors.error || !active) return;
          const factor = factors.data.totp.find(item => item.status === "verified");
          if (factor) setMfaFactorId(factor.id);
        }
      } catch {
        // The regular sign-in form remains available when session restoration fails.
      }
    }
    void resumeMfa();
    return () => { active = false; };
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) return;

    setLoading(true);
    setMessage("");
    setIsError(false);

    try {
      const supabase = createClient();

      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/confirm`,
          },
        });

        if (error) throw error;

        setMessage(
          "Cadastro realizado. Verifique seu e-mail para confirmar a conta."
        );
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (assurance.error) throw assurance.error;
        if (assurance.data.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2") {
          const factors = await supabase.auth.mfa.listFactors();
          if (factors.error) throw factors.error;
          const factor = factors.data.totp.find((item) => item.status === "verified");
          if (!factor) throw new Error("Segundo fator não disponível. Entre em contato com o suporte.");
          setMfaFactorId(factor.id);
          setPassword("");
          return;
        }
        router.push("/dashboard");
        router.refresh();
      }
    } catch (error) {
      setIsError(true);
      setMessage(
        error instanceof Error
          ? error.message
          : "Ocorreu um erro. Tente novamente."
      );
    } finally {
      setLoading(false);
    }
  }

  async function requestPasswordReset() {
    if (loading) return;
    if (!email.trim()) {
      setIsError(true);
      setMessage("Informe seu e-mail acima para receber o link de recuperação.");
      return;
    }
    setLoading(true);
    setMessage("");
    setIsError(false);
    try {
      const result = await createClient().auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/recovery-callback`,
      });
      if (result.error) throw result.error;
      setMessage("Se este e-mail estiver cadastrado, você receberá instruções para redefinir sua senha.");
    } catch {
      setIsError(true);
      setMessage("Não foi possível solicitar a recuperação. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyMfa(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading || !/^\d{6}$/.test(mfaCode)) return;
    setLoading(true);
    setMessage("");
    setIsError(false);
    try {
      const supabase = createClient();
      const challenge = await supabase.auth.mfa.challenge({ factorId: mfaFactorId });
      if (challenge.error) throw challenge.error;
      const result = await supabase.auth.mfa.verify({
        factorId: mfaFactorId, challengeId: challenge.data.id, code: mfaCode,
      });
      if (result.error) throw result.error;
      setMfaCode("");
      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : "Código inválido.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#090716] px-4 py-10 text-white sm:px-6">
      <div aria-hidden="true" className="pointer-events-none absolute -top-36 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-violet-700/20 blur-3xl" />
      <div className="relative z-10 w-full max-w-md rounded-3xl border border-violet-400/20 bg-slate-950/90 p-6 shadow-2xl shadow-violet-950/40 backdrop-blur-xl sm:p-9">
        <div className="mb-8 flex items-center gap-3"><span aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-600 text-2xl font-black shadow-lg shadow-violet-600/30">M</span><div><h1 className="text-2xl font-bold tracking-tight">MYRYRA</h1><p className="text-xs tracking-widest text-violet-300">YOUR LIFE. IN SYNC.</p></div></div><h2 className="text-2xl font-semibold">{mode === "login" ? "Bem-vindo de volta" : "Comece sua jornada"}</h2>

        <p className="mt-2 text-slate-400">
          {mode === "login"
            ? "Entre na sua conta."
            : "Crie sua conta gratuitamente."}
        </p>

        {mfaFactorId ? (
          <form onSubmit={verifyMfa} className="mt-8 space-y-4">
            <label htmlFor="mfa-code" className="block text-sm">Código do aplicativo autenticador</label>
            <input id="mfa-code" type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" required value={mfaCode} onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, "").slice(0, 6))} className="w-full rounded-xl border border-violet-400/30 bg-slate-900 p-3 text-white" />
            <button type="submit" disabled={loading || mfaCode.length !== 6} className="w-full rounded-xl bg-violet-600 p-3 font-semibold disabled:opacity-50">{loading ? "Verificando..." : "Verificar e entrar"}</button>
            <button type="button" onClick={async () => { await createClient().auth.signOut(); setMfaFactorId(""); setMfaCode(""); setMessage(""); }} className="text-sm text-violet-300">Voltar ao login</button>
          </form>
        ) : <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div>
            <label htmlFor="email" className="mb-2 block text-sm">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={loading}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-500/30 disabled:opacity-50"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-2 block text-sm">
              Senha
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={loading}
              className="w-full rounded-lg bg-slate-800 p-3 disabled:opacity-50"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-violet-600 p-3 font-semibold shadow-lg shadow-violet-900/30 transition hover:bg-violet-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400 disabled:opacity-50"
          >
            {loading
              ? "Aguarde..."
              : mode === "login"
                ? "Entrar"
                : "Criar conta"}
          </button>
        </form>}

        {message && (
          <p
            role={isError ? "alert" : "status"}
            className={`mt-4 text-sm ${
              isError ? "text-red-300" : "text-amber-300"
            }`}
          >
            {message}
          </p>
        )}

        {!mfaFactorId && mode === "login" && <button type="button" disabled={loading} onClick={() => void requestPasswordReset()} className="mt-4 block text-sm text-violet-300 hover:text-violet-200 disabled:opacity-50">Esqueci minha senha</button>}

        {!mfaFactorId && <button
          type="button"
          disabled={loading}
          onClick={() => {
            setMode(mode === "login" ? "signup" : "login");
            setMessage("");
            setIsError(false);
          }}
          className="mt-6 text-sm text-violet-300 hover:text-violet-200 disabled:opacity-50"
        >
          {mode === "login"
            ? "Ainda não tem conta? Cadastre-se"
            : "Já tem conta? Faça login"}
        </button>}
      </div>
    </main>
  );
}