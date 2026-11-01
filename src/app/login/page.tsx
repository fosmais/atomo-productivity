"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import MykaLoginScene from "./myka-login-scene";
import MykaPlanHelp from "./myka-plan-help";

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
  const [mfaFactors, setMfaFactors] = useState<{ id: string; name: string }[]>([]);

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
          if (factor) { setMfaFactors(factors.data.totp.filter(item => item.status === "verified").map(item => ({ id: item.id, name: item.friendly_name || "Autenticador" }))); setMfaFactorId(factor.id); }
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
        if (password.length < 12) {
          throw new Error("Para criar sua conta, use uma senha com pelo menos 12 caracteres.");
        }
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
          setMfaFactors(factors.data.totp.filter(item => item.status === "verified").map(item => ({ id: item.id, name: item.friendly_name || "Autenticador" })));
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
    <main className="relative isolate flex min-h-dvh items-center justify-center overflow-x-hidden bg-[#070716] px-4 py-6 text-white sm:px-6">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-cover bg-center" style={{backgroundImage:"linear-gradient(90deg,rgba(8,7,24,.15),rgba(8,7,24,.36)),url('/milky-way-login.svg')"}} />
      <div className="relative z-10 grid w-full max-w-6xl items-center justify-center gap-8 lg:grid-cols-[minmax(0,390px)_minmax(0,460px)] lg:gap-14">
        <div className="hidden lg:block"><MykaLoginScene /></div>
        <div className="mx-auto w-full max-w-[460px]">
          <div className="mb-4 text-center lg:text-left">
            <h2 className="text-[clamp(1.5rem,2.2vw,2rem)] font-bold leading-tight tracking-tight text-white">Seu universo, <span className="text-violet-300">em sintonia.</span></h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">Organize sua vida. Transforme planos em conquistas.</p>
          </div>
          <div className="relative mx-auto mb-5 flex w-full max-w-[210px] items-center justify-center lg:hidden" aria-label="MYKA, sua companheira inteligente">
            <div aria-hidden="true" className="absolute inset-4 rounded-full bg-violet-500/25 blur-2xl" />
            <img src="/myka-transparente.png" alt="MYKA, sua companheira inteligente" className="relative h-auto w-full drop-shadow-[0_12px_28px_rgba(120,65,255,.4)]" />
          </div>
          <div className="rounded-3xl border border-violet-300/45 bg-slate-950/90 p-5 shadow-2xl shadow-violet-950/40 backdrop-blur-xl sm:p-7">
        <div className="mb-4 flex items-center gap-3"><span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl"><img src="/myryra-logo.png" alt="Logotipo MYRYRA" className="h-full w-full object-cover" /></span><div><h1 className="text-2xl font-bold tracking-tight">MYRYRA</h1><p className="text-xs tracking-widest text-violet-300">YOUR LIFE. IN SYNC.</p></div></div><h2 className="text-2xl font-semibold">{mode === "login" ? "Bem-vindo de volta" : "Comece sua jornada"}</h2>

        <p className="mt-2 text-slate-400">
          {mode === "login"
            ? "Entre na sua conta."
            : "Crie sua conta gratuitamente."}
        </p>

        {mfaFactorId ? (
          <form onSubmit={verifyMfa} className="mt-5 space-y-3">
            {mfaFactors.length > 1 && <label className="block text-sm">Escolha o autenticador<select value={mfaFactorId} disabled={loading} onChange={e => { setMfaFactorId(e.target.value); setMfaCode(""); }} className="mt-2 w-full rounded-xl bg-slate-900 p-3">{mfaFactors.map((factor, index) => <option key={factor.id} value={factor.id}>{factor.name} ({index + 1})</option>)}</select></label>}
            <label htmlFor="mfa-code" className="block text-sm">Código do aplicativo autenticador</label>
            <input id="mfa-code" type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" required value={mfaCode} onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, "").slice(0, 6))} className="w-full rounded-xl border border-violet-400/30 bg-slate-900 p-3 text-white" />
            <button type="submit" disabled={loading || mfaCode.length !== 6} className="w-full rounded-xl bg-violet-600 p-3 font-semibold disabled:opacity-50">{loading ? "Verificando..." : "Verificar e entrar"}</button>
            <button type="button" onClick={async () => { await createClient().auth.signOut(); setMfaFactorId(""); setMfaFactors([]); setMfaCode(""); setMessage(""); }} className="text-sm text-violet-300">Voltar ao login</button>
          </form>
        ) : <form onSubmit={handleSubmit} className="mt-5 space-y-3">
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
              className="w-full rounded-xl border border-slate-600/70 bg-slate-900/90 p-3 outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-500/30 disabled:opacity-50"
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
              minLength={mode === "signup" ? 12 : undefined}
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={loading}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-500/30 disabled:opacity-50"
            />
          </div>

          {mode === "signup" && <p className="text-xs text-slate-400">Use pelo menos 12 caracteres na senha.</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 p-3 font-semibold shadow-lg shadow-violet-900/30 transition hover:from-violet-500 hover:to-fuchsia-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400 disabled:opacity-50"
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
          className="mt-4 text-sm text-violet-300 hover:text-violet-200 disabled:opacity-50"
        >
          {mode === "login"
            ? "Ainda não tem conta? Cadastre-se"
            : "Já tem conta? Faça login"}
        </button>}
          </div>
        </div>
      </div>
      <MykaPlanHelp onStartFree={() => { setMode("signup"); setMessage(""); setIsError(false); window.scrollTo({top:0,behavior:"smooth"}); }} />
    </main>
  );
}