import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import CloudPlans from "./cloud-plans";
import { LogoutButton } from "./logout-button";

async function DashboardContent() {
  await connection();

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
        Meu painel — Átomo Productivity
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