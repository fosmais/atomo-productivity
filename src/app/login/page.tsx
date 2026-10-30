"use client";

import { useState, type FormEvent } from "react";
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

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
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
        </form>

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

        <button
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
        </button>
      </div>
    </main>
  );
}