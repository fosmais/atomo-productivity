import { redirect } from "next/navigation";
import { connection } from "next/server";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import MikaJourneyPlanner from "../dashboard/mika-journey-planner";

export default async function JourneyPage() {
  await connection();
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");
  const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error || (assurance.data.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2")) redirect("/login");
  return (
    <main className="min-h-screen bg-slate-950 px-3 py-5 text-white sm:px-6">
      <div className="mx-auto max-w-5xl space-y-5">
        <nav><Link href="/dashboard" className="text-sm text-violet-300 hover:text-white">← Voltar ao meu universo</Link></nav>
        <header className="rounded-3xl border border-violet-400/30 bg-gradient-to-br from-violet-950 via-slate-900 to-slate-950 p-6 sm:p-9">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-300">MYRYRA · JOURNEY</p>
          <h1 className="mt-3 text-3xl font-bold sm:text-4xl">Seu sonho merece um caminho.</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">Transforme um objetivo em pequenas missões, acompanhe sua evolução e avance no seu ritmo com a MIKA.</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4"><p className="text-xl">✦</p><h2 className="mt-2 font-semibold">Escolha um sonho</h2><p className="mt-1 text-xs text-slate-300">Defina onde quer chegar.</p></div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4"><p className="text-xl">◇</p><h2 className="mt-2 font-semibold">Construa seu caminho</h2><p className="mt-1 text-xs text-slate-300">Revise as missões antes de confirmar.</p></div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4"><p className="text-xl">◎</p><h2 className="mt-2 font-semibold">Celebre cada avanço</h2><p className="mt-1 text-xs text-slate-300">Marque missões realizadas e veja seu progresso.</p></div>
          </div>
        </header>
        <MikaJourneyPlanner />
        <p className="text-center text-xs text-slate-400">MYRAs e jornadas compartilhadas estão planejadas para uma próxima etapa; nenhuma recompensa é concedida nesta versão.</p>
      </div>
    </main>
  );
}
