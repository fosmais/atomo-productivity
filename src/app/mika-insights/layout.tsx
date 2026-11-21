import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "MIKA Insights | MYRYRA",
  description: "Capture ideias, organize seus insights e transforme sugestões da MIKA em planos para revisar.",
  robots: { index: false, follow: false },
};

async function AuthenticatedInsights({ children }: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login?next=%2Fmika-insights");

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-violet-500/20 bg-slate-900/90">
        <nav aria-label="Navegação MYRYRA" className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-8">
          <Link href="/" className="text-xl font-bold tracking-wide text-violet-300">MYRYRA</Link>
          <div className="flex items-center gap-4 text-sm">
            <span aria-current="page" className="font-semibold text-violet-300">MIKA Insights</span>
            <Link href="/dashboard" className="text-slate-300 hover:text-white">Meu painel</Link>
          </div>
        </nav>
      </header>
      {children}
    </div>
  );
}

export default function MikaInsightsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <Suspense fallback={<main className="min-h-screen bg-slate-950 p-8 text-center text-slate-200">Carregando MYRYRA Insights...</main>}>
      <AuthenticatedInsights>{children}</AuthenticatedInsights>
    </Suspense>
  );
}
