"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import HealthDailyLog from "./health-daily-log";
import HealthProgress from "./health-progress";
import HealthWorkoutPlanner from "./health-workout-planner";
import { useVyraNavigation } from "./vyra-module-context";

type Goal = "lose" | "maintain" | "gain" | "fitness";
const goals: { id: Goal; label: string }[] = [
  { id: "lose", label: "Perder peso" },
  { id: "maintain", label: "Manter o peso" },
  { id: "gain", label: "Ganhar peso ou massa" },
  { id: "fitness", label: "Melhorar condicionamento" },
];
const activities = ["Academia", "Corrida", "Caminhada", "Ciclismo", "Exercícios em casa", "Meditação"];
export default function HealthWorkspace() {
  const { navigateTo } = useVyraNavigation();
  const [goal, setGoal] = useState<Goal>("fitness");
  const [selected, setSelected] = useState<string[]>([]);
  const [days, setDays] = useState(3);
  const [minutes, setMinutes] = useState(30);
  const [limitations, setLimitations] = useState("");
  const [consent, setConsent] = useState(false);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profileSaved, setProfileSaved] = useState(false);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) { if (!cancelled) setLoadingProfile(false); return; }
      const { data, error } = await supabase.from("myryra_health_profiles").select("goal,activities,days_per_week,minutes_per_session,limitations").eq("user_id", user.id).maybeSingle();
      if (cancelled) return;
      if (data) {
        setGoal(data.goal as Goal);
        setSelected(Array.isArray(data.activities) ? data.activities.filter((value: string) => activities.includes(value)) : []);
        setDays(data.days_per_week);
        setMinutes(data.minutes_per_session);
        setLimitations(data.limitations || "");
        setProfileSaved(true);
      } else if (error) setMessage("Não foi possível carregar seu perfil. Tente novamente.");
      setLoadingProfile(false);
    }
    void load();
    return () => { cancelled = true; };
  }, []);
  async function saveProfile() {
    if (!consent) { setMessage("Autorize o armazenamento do perfil antes de salvar."); return; }
    setSaving(true);
    setMessage("");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setMessage("Entre na sua conta para salvar o perfil."); setSaving(false); return; }
    const { error } = await supabase.from("myryra_health_profiles").upsert({
      user_id: user.id, goal, activities: selected, days_per_week: days,
      minutes_per_session: minutes, limitations: limitations.trim(), updated_at: new Date().toISOString()
    }, { onConflict: "user_id" });
    setSaving(false);
    if (error) setMessage("Não foi possível salvar seu perfil. Tente novamente.");
    else { setProfileSaved(true); setMessage("Perfil salvo com segurança."); window.dispatchEvent(new Event("myryra:health:profile-changed")); }
  }
  async function deleteProfile() {
    if (!window.confirm("Excluir seu perfil de saúde salvo? Esta ação não pode ser desfeita.")) return;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("myryra_health_profiles").delete().eq("user_id", user.id);
    if (error) { setMessage("Não foi possível excluir o perfil."); return; }
    setProfileSaved(false); setMessage("Perfil de saúde excluído."); window.dispatchEvent(new Event("myryra:health:profile-changed"));
  }
  async function eraseHealthData() {
    if (!window.confirm("Excluir permanentemente seu perfil e todo o histórico de saúde? Esta ação não pode ser desfeita.")) return;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setMessage("Entre na sua conta para excluir os dados."); return; }
    setSaving(true);
    const logs = await supabase.from("myryra_health_logs").delete().eq("user_id", user.id);
    if (logs.error) { setSaving(false); setMessage("Não foi possível excluir o histórico."); return; }
    const profile = await supabase.from("myryra_health_profiles").delete().eq("user_id", user.id);
    setSaving(false);
    if (profile.error) { setMessage("Histórico excluído, mas não foi possível excluir o perfil."); window.dispatchEvent(new Event("myryra:health:changed")); return; }
    setProfileSaved(false); setGoal("fitness"); setSelected([]); setDays(3); setMinutes(30); setLimitations(""); setConsent(false);
    setMessage("Seu perfil e histórico de saúde foram excluídos.");
    window.dispatchEvent(new Event("myryra:health:changed"));
    window.dispatchEvent(new Event("myryra:health:profile-changed"));
  }
  function openMika() {
    if (!consent) { setMessage("Confirme antes de enviar suas respostas à MIKA."); return; }
    const objective = goals.find(item => item.id === goal)?.label ?? "";
    const prompt = [
      "Atue como MIKA, assistente de hábitos saudáveis da MYRYRA.",
      "Faça uma avaliação inicial conversacional e proponha uma rotina de bem-estar gradual, adaptável e não clínica.",
      "Objetivo: " + objective + ".",
      "Atividades de interesse: " + (selected.join(", ") || "a descobrir") + ".",
      "Disponibilidade: " + days + " dias por semana, " + minutes + " minutos por sessão.",
      "Limitações informadas voluntariamente: " + (limitations.trim() || "não informadas") + ".",
      "Pergunte sobre experiência, preferências, alimentação, sono, hidratação e meditação antes de sugerir um plano.",
      "Não diagnostique, não prescreva dieta, calorias, suplementos ou tratamento; não prometa resultados. Em caso de sintomas, lesões, gravidez ou condições médicas, recomende avaliação profissional.",
      "Sugira treinos de forma conservadora, com aquecimento, descanso e progressão gradual. Não presuma que ausência de limitações significa aptidão médica.",
      "Peça permissão antes de usar dados de saúde em outras funcionalidades. Não publique dados ou progresso automaticamente."
    ].join("\n");
    try {
      sessionStorage.setItem("myryra:myka:health-handoff", prompt.slice(0, 3500));
      navigateTo("vyra-ai");
    } catch { setMessage("Não foi possível abrir a MIKA. Tente novamente."); }
  }
  return <div className="space-y-5">
    <div className="rounded-2xl border border-violet-400/25 bg-gradient-to-r from-violet-950/40 to-slate-900/70 p-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-violet-300">MYRYRA Saúde · Avaliação inicial</p>
      <h3 className="mt-2 text-xl font-semibold text-white">Seu bem-estar, no seu ritmo.</h3>
      <p className="mt-2 text-sm text-slate-300">Conte à MIKA o que você gosta de fazer e o que deseja melhorar. Ela ajuda a organizar uma rotina realista.</p>
      <p className="mt-2 text-xs text-slate-400">Seu perfil só será salvo quando você autorizar. Você pode editá-lo ou excluí-lo quando quiser.</p>
    </div>
    <fieldset className="space-y-2"><legend className="text-sm font-semibold text-white">Qual é seu objetivo?</legend><div className="grid gap-2 sm:grid-cols-2">{goals.map(item => <label key={item.id} className={"cursor-pointer rounded-xl border p-3 text-sm " + (goal === item.id ? "border-violet-400 bg-violet-600/20" : "border-white/15 bg-slate-900/60")}><input type="radio" name="health-goal" checked={goal === item.id} onChange={() => setGoal(item.id)} className="mr-2 accent-violet-500" />{item.label}</label>)}</div></fieldset>
    <fieldset className="space-y-2"><legend className="text-sm font-semibold text-white">De quais atividades você gosta?</legend><div className="flex flex-wrap gap-2">{activities.map(activity => <label key={activity} className={"cursor-pointer rounded-full border px-3 py-2 text-sm " + (selected.includes(activity) ? "border-violet-400 bg-violet-600/20" : "border-white/15 bg-slate-900/60")}><input type="checkbox" checked={selected.includes(activity)} onChange={e => setSelected(current => e.target.checked ? [...current, activity] : current.filter(a => a !== activity))} className="mr-2 accent-violet-500" />{activity}</label>)}</div></fieldset>
    <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm text-slate-200">Dias disponíveis por semana<select value={days} onChange={e => setDays(Number(e.target.value))} className="mt-2 w-full rounded-xl border border-white/20 bg-slate-900 p-3 text-white">{[1,2,3,4,5,6,7].map(day => <option key={day} value={day}>{day} {day === 1 ? "dia" : "dias"}</option>)}</select></label><label className="text-sm text-slate-200">Minutos por sessão<select value={minutes} onChange={e => setMinutes(Number(e.target.value))} className="mt-2 w-full rounded-xl border border-white/20 bg-slate-900 p-3 text-white">{[15,20,30,45,60,90].map(value => <option key={value} value={value}>{value} minutos</option>)}</select></label></div>
    <label className="block text-sm text-slate-200">Há limitações ou cuidados que a MIKA deva considerar? (opcional)<textarea value={limitations} maxLength={500} onChange={e => setLimitations(e.target.value)} rows={3} placeholder="Compartilhe apenas o que considerar necessário." className="mt-2 w-full rounded-xl border border-white/20 bg-slate-900 p-3 text-white placeholder:text-slate-500" /></label>
    <label className="flex items-start gap-3 text-sm text-slate-300"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-1 accent-violet-500" /><span>Autorizo o uso destas respostas para salvar meu perfil de saúde ou conversar com a MIKA sobre bem-estar. Posso excluir o perfil quando quiser.</span></label>
    {message && <p role="alert" className="text-sm text-amber-300">{message}</p>}
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" disabled={saving || loadingProfile} onClick={() => void saveProfile()} className="rounded-xl border border-violet-400/50 px-4 py-3 font-semibold text-violet-100 hover:bg-violet-600/20 disabled:opacity-50">{saving ? "Salvando..." : loadingProfile ? "Carregando..." : "Salvar meu perfil"}</button>
      {profileSaved && <button type="button" onClick={() => void deleteProfile()} className="rounded-xl border border-rose-400/30 px-4 py-3 text-sm text-rose-200 hover:bg-rose-500/10">Excluir perfil salvo</button>}
    </div>
    <button type="button" onClick={openMika} className="w-full rounded-xl bg-violet-600 px-4 py-3 font-semibold text-white hover:bg-violet-500 sm:w-auto">Continuar avaliação com a MIKA</button>
    <HealthWorkoutPlanner />
    <HealthProgress />
    <HealthDailyLog />
    <div className="rounded-xl border border-rose-400/20 p-3"><p className="text-xs text-slate-400">Privacidade: você controla seus registros de saúde.</p><button type="button" disabled={saving} onClick={() => void eraseHealthData()} className="mt-2 text-sm text-rose-300 underline disabled:opacity-50">Excluir todos os meus dados de saúde</button></div>
    <p className="text-xs leading-5 text-slate-400">A MYRYRA não substitui orientação médica, nutricional ou de educação física. O diário registra peso, refeições, sono, meditação e treinos; planos avançados e compartilhamento de progresso serão adicionados em etapas posteriores.</p>
  </div>;
}
