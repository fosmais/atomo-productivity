"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useVyraNavigation } from "./vyra-module-context";

type Profile = { goal: string; activities: string[]; days_per_week: number; minutes_per_session: number; limitations: string };
const goalLabels: Record<string,string> = { lose:"reduzir peso", maintain:"manter peso", gain:"ganhar peso ou massa", fitness:"melhorar condicionamento" };
export default function HealthWorkoutPlanner() {
  const { navigateTo } = useVyraNavigation();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [status, setStatus] = useState("Carregando preferências...");
  const [reviewed, setReviewed] = useState(false);
  useEffect(() => {
    let active = true;
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { if (active) setStatus("Entre na sua conta para planejar."); return; }
      const { data, error } = await supabase.from("myryra_health_profiles").select("goal,activities,days_per_week,minutes_per_session,limitations").eq("user_id", user.id).maybeSingle();
      if (!active) return;
      if (error) setStatus("Não foi possível carregar seu perfil.");
      else if (!data) setStatus("Preencha e salve sua avaliação inicial acima para personalizar seu plano.");
      else { setProfile(data as Profile); setStatus(""); }
    }
    void load();
    window.addEventListener("myryra:health:profile-changed", load);
    return () => { active = false; window.removeEventListener("myryra:health:profile-changed", load); };
  }, []);
  function askMika() {
    if (!profile || !reviewed) { setStatus("Confirme que deseja enviar seu perfil à MIKA."); return; }
    const prompt = [
      "Atue como MIKA Saúde. Crie uma proposta de rotina de atividades físicas educativa e conservadora, para revisão do usuário.",
      "Objetivo declarado: " + (goalLabels[profile.goal] || "bem-estar") + ".",
      "Atividades preferidas: " + (profile.activities.join(", ") || "não informadas") + ".",
      "Disponibilidade: " + profile.days_per_week + " dias por semana, " + profile.minutes_per_session + " minutos por sessão.",
      "Limitações voluntariamente informadas: " + (profile.limitations || "não informadas") + ".",
      "Antes de montar um plano, pergunte sobre idade/faixa etária, nível atual de atividade, experiência, lesões, restrições, acesso a equipamentos e necessidade de orientação profissional. Não interprete ausência de limitações como liberação médica.",
      "Depois, proponha uma semana inicial com dias, atividades preferidas, aquecimento, pausas, descanso e progressão gradual; ofereça alternativas leves e adaptação à agenda.",
      "Não prescreva intensidade alta, cargas, séries máximas, metas agressivas de perda de peso, dietas, calorias ou suplementos. Se houver condição médica, sintomas, dor ou lesão, oriente avaliação por profissional habilitado.",
      "Não crie eventos nem altere a agenda sem autorização explícita. A proposta não substitui profissional de educação física."
    ].join("\n");
    try { sessionStorage.setItem("myryra:myka:health-handoff", prompt.slice(0,3500)); navigateTo("vyra-ai"); }
    catch { setStatus("Não foi possível abrir a MIKA."); }
  }
  return <section className="space-y-3 rounded-2xl border border-violet-400/20 bg-slate-900/60 p-4 sm:p-5">
    <p className="text-xs font-semibold uppercase tracking-widest text-violet-300">MIKA · Planejamento personalizado</p>
    <h3 className="text-lg font-semibold text-white">Sua rotina de atividades</h3>
    <p className="text-sm text-slate-300">A MIKA usa suas preferências para conversar sobre uma rotina inicial. Primeiro ela confirma experiência e cuidados necessários; depois sugere uma semana adaptável.</p>
    {profile && <div className="grid gap-2 sm:grid-cols-3">
      <div className="rounded-xl border border-white/10 bg-slate-950/50 p-3"><p className="text-xs text-slate-400">Objetivo</p><p className="mt-1 text-sm text-white">{goalLabels[profile.goal] || "Bem-estar"}</p></div>
      <div className="rounded-xl border border-white/10 bg-slate-950/50 p-3"><p className="text-xs text-slate-400">Disponibilidade</p><p className="mt-1 text-sm text-white">{profile.days_per_week} dias · {profile.minutes_per_session} min</p></div>
      <div className="rounded-xl border border-white/10 bg-slate-950/50 p-3"><p className="text-xs text-slate-400">Preferências</p><p className="mt-1 text-sm text-white">{profile.activities.join(", ") || "A definir"}</p></div>
    </div>}
    {profile && <label className="flex items-start gap-2 text-sm text-slate-300"><input type="checkbox" checked={reviewed} onChange={e => setReviewed(e.target.checked)} className="mt-1 accent-violet-500" />Quero compartilhar estas preferências com a MIKA para planejar minha rotina.</label>}
    <button type="button" disabled={!profile || !reviewed} onClick={askMika} className="rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">Personalizar treino com a MIKA</button>
    {status && <p role="status" className="text-sm text-violet-200">{status}</p>}
    <p className="text-xs text-slate-400">O plano é uma sugestão geral. Nenhum treino é automaticamente agendado ou prescrito.</p>
  </section>;
}
