"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import MykaLoginScene from "./myka-login-scene";
import MykaPlanHelp from "./myka-plan-help";
import TurnstileCaptcha from "./turnstile-captcha";
import HcaptchaCaptcha from "./hcaptcha-captcha";

export default function LoginPage() {
  const router = useRouter();
  const [returnTo, setReturnTo] = useState("/dashboard");
  const hcaptchaEnabled = Boolean(process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY);
  const captchaEnabled = hcaptchaEnabled || Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
  const passwordMin = captchaEnabled ? 6 : 12;
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaReset, setCaptchaReset] = useState(0);

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
    const params = new URLSearchParams(window.location.search);
    if (params.get("mode") === "signup") setMode("signup");
    const errorCode = params.get("error");
    const requestedReturn = params.get("next");
    if (requestedReturn === "/suporte-admin") setReturnTo(requestedReturn);
    if (params.get("mfa") === "required") { setMessage("Acesso Google concluído. Aguarde a verificação do autenticador para finalizar o login."); setIsError(false); }
    if (errorCode === "recovery") {
      setIsError(true);
      setMessage("O link de recuperação é inválido ou expirou. Solicite um novo e-mail.");
    } else if (errorCode === "oauth") {
      setIsError(true);
      setMessage("Não foi possível concluir o acesso com Google. Tente novamente.");
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
          router.replace(requestedReturn === "/suporte-admin" ? "/suporte-admin" : "/dashboard");
          router.refresh();
          return;
        }
        if (assurance.data.nextLevel === "aal2") {
          const factors = await supabase.auth.mfa.listFactors();
          if (factors.error || !active) return;
          const factor = factors.data.totp.find(item => item.status === "verified");
          if (factor) { setMessage("Confirme o código de seis dígitos do autenticador para continuar."); setIsError(false); setMfaFactors(factors.data.totp.filter(item => item.status === "verified").map(item => ({ id: item.id, name: item.friendly_name || "Autenticador" }))); setMfaFactorId(factor.id); }
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
        if (password.length < passwordMin) {
          throw new Error(`Para criar sua conta, use uma senha com pelo menos ${passwordMin} caracteres.`);
        }
        if (captchaEnabled && !captchaToken) throw new Error("Conclua a verificação antirobô.");
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/confirm`,
            ...(captchaEnabled ? { captchaToken } : {}),
          },
        });

        if (error) throw error;

        if (data.session) {
          // When email confirmation is disabled, Supabase signs the user in immediately.
          router.replace("/dashboard");
          router.refresh();
          return;
        }

        setPassword("");
        setMessage(
          "Solicitação recebida! Se o endereço estiver apto para cadastro, enviaremos um link de confirmação. O e-mail poderá aparecer como enviado por Supabase Auth, serviço de autenticação da MYRYRA. Confira também a pasta de spam."
        );
      } else {
        if (captchaEnabled && !captchaToken) throw new Error("Conclua a verificação antirobô.");
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
          options: captchaEnabled ? { captchaToken } : undefined,
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
        router.push(returnTo);
        router.refresh();
      }
    } catch (error) {
      setIsError(true);
      const rawMessage = error instanceof Error ? error.message : "";
      const normalized = rawMessage.toLowerCase();
      if (normalized.includes("email rate limit exceeded") || normalized.includes("over_email_send_rate_limit")) {
        setMessage("Você solicitou vários e-mails em pouco tempo. Por segurança, o envio está temporariamente limitado. Aguarde um pouco antes de tentar novamente e confira sua caixa de entrada e spam.");
      } else if (normalized.includes("already-seen-response")) {
        setMessage("Esta verificação de segurança já foi utilizada. Marque novamente a opção 'I am human' e tente outra vez.");
      } else {
        setMessage(rawMessage || "Não foi possível concluir sua solicitação. Tente novamente em instantes.");
      }
    } finally {
      if (captchaEnabled) { setCaptchaToken(""); setCaptchaReset((n) => n + 1); }
      setLoading(false);
    }
  }

  async function signInWithGoogle() {
    if (loading || process.env.NEXT_PUBLIC_MYRYRA_GOOGLE_LOGIN_ENABLED !== "true") return;
    setLoading(true);
    setMessage("");
    setIsError(false);
    try {
      const { error } = await createClient().auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/oauth-callback${returnTo === "/suporte-admin" ? "?next=%2Fsuporte-admin" : ""}` },
      });
      if (error) throw error;
    } catch {
      setIsError(true);
      setMessage("Não foi possível iniciar o acesso com Google. Tente novamente.");
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
      if (captchaEnabled && !captchaToken) throw new Error("Conclua a verificação antirobô.");
      const result = await createClient().auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/recovery-callback`,
        ...(captchaEnabled ? { captchaToken } : {}),
      });
      if (result.error) throw result.error;
      setMessage("Se este e-mail estiver cadastrado, você receberá instruções para redefinir sua senha.");
    } catch {
      setIsError(true);
      setMessage("Não foi possível solicitar a recuperação. Tente novamente.");
    } finally {
      if (captchaEnabled) { setCaptchaToken(""); setCaptchaReset((n) => n + 1); }
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
    <main className="relative isolate flex min-h-dvh items-start justify-center overflow-x-hidden bg-[#070716] px-4 py-5 lg:items-center lg:py-4 text-white sm:px-6">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse at 26% 38%, rgba(124,58,237,.42), transparent 37%), radial-gradient(ellipse at 76% 70%, rgba(14,165,233,.25), transparent 39%), radial-gradient(ellipse at 70% 15%, rgba(168,85,247,.23), transparent 30%), #070716" }} />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-70" style={{ backgroundImage: "radial-gradient(1px 1px at 12% 16%, white 98%, transparent), radial-gradient(2px 2px at 36% 62%, #d8b4fe 98%, transparent), radial-gradient(1px 1px at 77% 22%, white 98%, transparent), radial-gradient(1px 1px at 86% 82%, #a5f3fc 98%, transparent), radial-gradient(1px 1px at 53% 39%, white 98%, transparent)", backgroundSize: "173px 197px, 263px 283px, 199px 241px, 307px 269px, 131px 163px" }} />
      <div aria-hidden="true" className="pointer-events-none absolute left-1/4 top-1/4 h-[35rem] w-[35rem] rounded-full bg-violet-600/15 blur-[100px]" />
      <div className="relative z-10 grid w-full max-w-6xl items-center justify-center gap-8 lg:grid-cols-[minmax(0,390px)_minmax(0,460px)] lg:gap-14">
        <div className="hidden lg:flex items-center justify-center"><MykaLoginScene /></div>
        <div className="mx-auto w-full max-w-[460px]">
          <div className="mb-2 text-center lg:text-left">
            <h2 className="text-[clamp(1.5rem,2.2vw,2rem)] font-bold leading-tight tracking-tight text-white">Seu universo, <span className="text-violet-300">em sintonia.</span></h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">Organize sua vida. Transforme planos em conquistas.</p>
          </div>
          <div className="relative mx-auto mb-5 flex w-full max-w-[165px] items-center justify-center lg:hidden" aria-label="MYKA, sua companheira inteligente">
            <div aria-hidden="true" className="absolute inset-4 rounded-full bg-violet-500/25 blur-2xl" />
            <img src="/myka-transparente.png" alt="MYKA, sua companheira inteligente" className="relative h-auto w-full drop-shadow-[0_12px_28px_rgba(120,65,255,.4)]" />
          </div>
          <div className="rounded-3xl border border-violet-300/45 bg-slate-950/90 p-4 shadow-2xl shadow-violet-950/40 backdrop-blur-xl sm:p-5">
        <button type="button" disabled={loading} onClick={() => { if (mode === "signup" || mfaFactorId) { setMode("login"); setMfaFactorId(""); setMfaCode(""); setMessage(""); setIsError(false); setCaptchaToken(""); setCaptchaReset(n => n + 1); } else { router.push("/"); } }} className="mb-2 inline-flex items-center gap-2 rounded-lg px-2 py-1 text-sm text-violet-200 transition hover:bg-white/10 hover:text-white disabled:opacity-50" aria-label={mode === "signup" ? "Voltar para login" : "Voltar para início"}><span aria-hidden="true">←</span> Voltar</button>
        <div className="mb-3 flex items-center gap-3"><span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl"><img src="/myryra-logo.png" alt="Logotipo MYRYRA" className="h-full w-full object-cover" /></span><div><h1 className="text-2xl font-bold tracking-tight">MYRYRA</h1><p className="text-xs tracking-widest text-violet-300">YOUR LIFE. IN SYNC.</p></div></div><h2 className="text-2xl font-semibold">{mode === "login" ? "Bem-vindo de volta" : "Comece sua jornada"}</h2>

        <p className="mt-2 text-slate-400">
          {mode === "login"
            ? "Entre na sua conta."
            : "Plano Free · R$ 0,00 · Sem cartão de crédito."}
        </p>

        {mode === "signup" && !mfaFactorId && (
          <p className="mt-3 text-sm text-violet-200">A MYKA acompanha seus primeiros passos na organização da rotina.</p>
        )}
        {mode === "signup" && !mfaFactorId && process.env.NEXT_PUBLIC_MYRYRA_GOOGLE_LOGIN_ENABLED === "true" && (
          <div className="mt-4">
            <button type="button" disabled={loading} onClick={() => void signInWithGoogle()} className="flex w-full items-center justify-center gap-2 rounded-xl border border-violet-400/50 bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"><span aria-hidden="true" className="font-bold text-violet-300">G</span> Criar conta com Google</button>
            <p className="mt-3 text-center text-xs text-slate-400">ou cadastre-se com e-mail</p>
          </div>
        )}

        {mfaFactorId ? (
          <form onSubmit={verifyMfa} className="mt-4 space-y-3">
            {mfaFactors.length > 1 && <label className="block text-sm">Escolha o autenticador<select value={mfaFactorId} disabled={loading} onChange={e => { setMfaFactorId(e.target.value); setMfaCode(""); }} className="mt-2 w-full rounded-xl bg-slate-900 p-3">{mfaFactors.map((factor, index) => <option key={factor.id} value={factor.id}>{factor.name} ({index + 1})</option>)}</select></label>}
            <label htmlFor="mfa-code" className="block text-sm">Código do aplicativo autenticador</label>
            <input id="mfa-code" type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" required value={mfaCode} onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, "").slice(0, 6))} className="w-full rounded-xl border border-violet-400/30 bg-slate-900 p-3 text-white" />
            <button type="submit" disabled={loading || mfaCode.length !== 6} className="w-full rounded-xl bg-violet-600 p-3 font-semibold disabled:opacity-50">{loading ? "Verificando..." : "Verificar e entrar"}</button>
            <button type="button" onClick={async () => { await createClient().auth.signOut(); setMfaFactorId(""); setMfaFactors([]); setMfaCode(""); setMessage(""); }} className="text-sm text-violet-300">Voltar ao login</button>
          </form>
        ) : <form onSubmit={handleSubmit} className="mt-4 space-y-3">
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
              minLength={mode === "signup" ? passwordMin : undefined}
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={loading}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-500/30 disabled:opacity-50"
            />
          </div>

          {mode === "signup" && <><p className="text-xs text-slate-400">Use pelo menos {passwordMin} caracteres na senha.</p></>}
          {mode === "signup" && (
            <div role="note" className="rounded-xl border border-violet-400/25 bg-violet-500/10 px-3 py-3 text-xs leading-relaxed text-violet-100">
              <p className="font-semibold">Confirmação por e-mail</p>
              <p className="mt-1 text-violet-200/90">Enviaremos um e-mail para confirmar seu endereço. Confira também a pasta de spam.</p>
            </div>
          )}
          {captchaEnabled && !mfaFactorId && (hcaptchaEnabled ? <HcaptchaCaptcha onToken={setCaptchaToken} resetSignal={captchaReset} /> : <TurnstileCaptcha onToken={setCaptchaToken} />)}
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


        {mode === "login" && !mfaFactorId && process.env.NEXT_PUBLIC_MYRYRA_GOOGLE_LOGIN_ENABLED === "true" && (
          <div className="mt-4">
            <div className="mb-3 flex items-center gap-3 text-xs text-slate-400"><span className="h-px flex-1 bg-white/15" />ou continue com<span className="h-px flex-1 bg-white/15" /></div>
            <button type="button" disabled={loading} onClick={() => void signInWithGoogle()} className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/20 bg-slate-900/90 px-4 py-3 text-sm font-semibold text-white transition hover:border-violet-400/70 disabled:opacity-50">
              <span aria-hidden="true" className="font-bold text-violet-300">G</span> Continuar com Google
            </button>
          </div>
        )}

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