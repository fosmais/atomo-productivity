import Link from "next/link";
import { BILLING_PLANS } from "@/lib/billing/plans";

const details = {
  free: { description: "Para começar a organizar sua rotina.", highlights: ["Agenda e tarefas", "Calendário básico", "What Now? básico"] },
  pro: { description: "Mais inteligência para planejar seus dias.", highlights: ["Smart Calendar", "What Now? e Daily Briefing", "AutoPilot e Weekly Intelligence"] },
  premium: { description: "Planejamento e análises mais completos.", highlights: ["Tudo do Pro", "Insights avançados", "Metas pessoais"] },
} as const;

function formatPrice(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

export default function PlanosPage() {
  const salesEnabled = process.env.BILLING_CHECKOUT_ENABLED === "true";
  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-12 text-white">
      <Link href="/dashboard" className="text-sm text-violet-300 hover:text-white">← Voltar ao painel</Link>
      <div className="mt-10 text-center">
        <p className="text-sm font-semibold tracking-[0.2em] text-violet-300">MYRYRA</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">Um plano para cada ritmo.</h1>
        <p className="mx-auto mt-4 max-w-2xl text-base text-zinc-300">Conheça os planos previstos para o MVP 1. Os recursos e valores ainda estão em homologação.</p>
      </div>
      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {Object.values(BILLING_PLANS).map((plan) => (
          <section key={plan.id} className={`rounded-3xl border p-7 ${plan.id === "pro" ? "border-violet-500 bg-violet-950/40" : "border-white/15 bg-white/5"}`}>
            <h2 className="text-2xl font-semibold">{plan.name}</h2>
            <p className="mt-2 min-h-12 text-sm text-zinc-300">{details[plan.id].description}</p>
            <p className="mt-5 text-3xl font-semibold">{formatPrice(plan.monthlyPriceCents)}<span className="text-sm font-normal text-zinc-300"> / mês</span></p>
            <p className="mt-3 text-sm text-violet-200">{plan.aiMessagesPerDay} interações de IA por dia (previstas)</p>
            <ul className="mt-7 space-y-3 text-sm text-zinc-200">
              {details[plan.id].highlights.map((item) => <li key={item}>✓ {item}</li>)}
            </ul>
            <div className="mt-8 rounded-xl border border-white/15 px-4 py-3 text-center text-sm text-zinc-300" aria-label="Assinaturas ainda não disponíveis">
              {salesEnabled ? "Checkout em preparação" : "Em breve"}
            </div>
          </section>
        ))}
      </div>
      <p className="mt-8 text-center text-xs text-zinc-400">Valores indicativos. Nenhuma contratação ou cobrança está disponível nesta página.</p>
    </main>
  );
}
