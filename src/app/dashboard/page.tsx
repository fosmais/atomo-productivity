import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CloudPlans from "./cloud-plans";
import { LogoutButton } from "./logout-button";

async function DashboardContent() {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-3xl font-bold">
        Meu painel — MYRYRA
      </h1>

      <p className="text-slate-300">
        Conta autenticada: {user.email}
      </p>

      <section className="rounded-xl border border-slate-800 p-6">
        <h2 className="text-xl font-semibold">
          Meus planos
        </h2>

        <CloudPlans />
      </section>

      <section aria-labelledby="mika-insights-title" className="rounded-xl border border-violet-500/40 bg-violet-950/30 p-6">
        <h2 id="mika-insights-title" className="text-xl font-semibold">MIKA Insights</h2>
        <p className="mt-2 text-sm text-slate-300">Capture ideias por texto ou voz, organize seus pensamentos e peça sugestões de próximos passos com IA. Nada é executado automaticamente.</p>
        <Link href="/mika-insights" className="mt-4 inline-flex rounded-lg bg-violet-600 px-4 py-2 font-semibold text-white hover:bg-violet-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300">Abrir MIKA Insights</Link>
      </section>

      <LogoutButton />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-slate-950 p-8 text-white">
      <Suspense
        fallback={
          <div className="mx-auto max-w-4xl text-slate-300">
            Carregando seu painel...
          </div>
        }
      >
        <DashboardContent />
      </Suspense>
    </main>
  );
}