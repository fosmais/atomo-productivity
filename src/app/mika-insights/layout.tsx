import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "MIKA Insights | MYRYRA",
  description: "Capture ideias e transforme insights em planos com a MIKA.",
  robots: { index: false, follow: false },
};

async function ProtectedInsights({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login?next=%2Fmika-insights");
  return (
    <div className="min-h-screen bg-[#081321] pb-24 text-slate-100">
      <header className="border-b border-violet-400/20 bg-[#0b1628]">
        <nav aria-label="Navegação MYRYRA" className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/dashboard" className="flex items-center gap-3">
            <img src="/myryra-aurora-purple.svg" alt="" className="h-10 w-10 rounded-xl" />
            <span className="font-bold tracking-[0.15em] text-violet-200">MYRYRA</span>
          </Link>
          <Link href="/dashboard" className="rounded-xl border border-violet-400/30 px-3 py-2 text-sm text-slate-200 hover:bg-violet-400/10">Voltar ao painel</Link>
        </nav>
      </header>
      {children}
    </div>
  );
}

export default function MikaInsightsLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<main className="min-h-screen bg-[#081321] p-8 text-slate-200">Carregando MIKA Insights...</main>}><ProtectedInsights>{children}</ProtectedInsights></Suspense>;
}
