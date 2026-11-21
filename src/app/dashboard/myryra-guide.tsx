"use client";
import { useState } from "react";
import { useVyraNavigation } from "./vyra-module-context";

const features = [
  { id: "vyra-calendar", title: "Agenda", detail: "Visualize compromissos, tarefas e horários livres. Use os cards de lembretes e disponibilidade quando precisar." },
  { id: "vyra-tasks", title: "Tarefas e metas", detail: "Registre o que precisa fazer, acompanhe prioridades e organize seus próximos passos." },
  { id: "vyra-ai", title: "MIKA", detail: "Converse com a assistente para organizar ideias, tirar dúvidas e planejar sua rotina. Confira as sugestões antes de aplicá-las." },
  { id: "vyra-finance", title: "Meu dinheiro", detail: "Registre receitas e despesas manualmente, acompanhe objetivos e planeje gastos. A MYRYRA não é um banco." },
  { id: "vyra-health", title: "Saúde e bem-estar", detail: "Explore atividades, planeje sua rotina e registre sua evolução. As orientações são educativas e não substituem profissionais de saúde." },
  { id: "vyra-performance", title: "Meu progresso", detail: "Acompanhe os indicadores disponíveis para entender sua evolução ao longo do tempo." },
];
export default function MyryraGuide() {
  const { navigateTo } = useVyraNavigation();
  const [expanded, setExpanded] = useState<string | null>(null);
  return <div className="space-y-4">
    <div className="rounded-2xl border border-violet-400/25 bg-gradient-to-br from-violet-950/50 to-slate-900/80 p-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-violet-300">GUIA DA MYRYRA</p>
      <h3 className="mt-2 text-xl font-semibold text-white">Sua vida, mais organizada.</h3>
      <p className="mt-2 text-sm text-slate-300">Conheça cada ferramenta no seu ritmo. Escolha um assunto, leia como funciona e abra a área correspondente.</p>
    </div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{features.map(feature =>
      <article key={feature.id} className="min-w-0 rounded-2xl border border-white/15 bg-slate-900/70 p-4">
        <h4 className="font-semibold text-white">{feature.title}</h4>
        <button type="button" aria-expanded={expanded === feature.id} onClick={() => setExpanded(current => current === feature.id ? null : feature.id)} className="mt-3 rounded-lg border border-violet-400/40 px-3 py-2 text-sm text-violet-100">{expanded === feature.id ? "Ocultar explicação" : "Como funciona?"}</button>
        {expanded === feature.id && <p className="mt-3 text-sm leading-6 text-slate-300">{feature.detail}</p>}
        <button type="button" onClick={() => navigateTo(feature.id)} className="mt-3 block text-sm font-semibold text-violet-300 underline underline-offset-4">Abrir ferramenta</button>
      </article>)}</div>
    <p className="text-xs text-slate-400">As funcionalidades disponíveis podem variar conforme o plano e as configurações da sua conta.</p>
  </div>;
}
