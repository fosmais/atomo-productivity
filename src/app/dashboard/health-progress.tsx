"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useVyraNavigation } from "./vyra-module-context";

type Log = { category: string; occurred_on: string; value: number | null; notes: string };
const labels: Record<string, string> = { weight: "Peso", workout: "Treinos", meal: "Alimentação", sleep: "Sono", meditation: "Meditação" };
export default function HealthProgress() {
  const { navigateTo } = useVyraNavigation();
  const [logs, setLogs] = useState<Log[]>([]);
  const [status, setStatus] = useState("Carregando indicadores...");
  useEffect(() => {
    let active = true;
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { if (active) setStatus("Entre na sua conta para acompanhar o progresso."); return; }
      const { data, error } = await supabase.from("myryra_health_logs").select("category,occurred_on,value,notes").eq("user_id", user.id).order("occurred_on", { ascending: false }).limit(500);
      if (!active) return;
      if (error) setStatus("Não foi possível carregar os indicadores.");
      else { setLogs((data || []) as Log[]); setStatus(""); }
    }
    void load();
    window.addEventListener("myryra:health:changed", load);
    return () => { active = false; window.removeEventListener("myryra:health:changed", load); };
  }, []);
  const summary = useMemo(() => {
    const since = new Date(); since.setDate(since.getDate() - 6);
    const cutoff = [since.getFullYear(),String(since.getMonth()+1).padStart(2,"0"),String(since.getDate()).padStart(2,"0")].join("-");
    const weekly = logs.filter(log => log.occurred_on >= cutoff);
    const weights = logs.filter(log => log.category === "weight" && log.value !== null);
    const sleep = weekly.filter(log => log.category === "sleep" && log.value !== null);
    const workouts = weekly.filter(log => log.category === "workout");
    const meditations = weekly.filter(log => log.category === "meditation");
    return {
      workouts: workouts.length,
      workoutMinutes: workouts.reduce((sum, log) => sum + (log.value || 0), 0),
      meditations: meditations.length,
      sleepAverage: sleep.length ? (sleep.reduce((sum, log) => sum + (log.value || 0), 0) / sleep.length).toFixed(1) : null,
      latestWeight: weights[0]?.value,
      weightDelta: weights.length > 1 ? Number(((weights[0].value || 0) - (weights[weights.length-1].value || 0)).toFixed(1)) : null,
      mealCount: weekly.filter(log => log.category === "meal").length,
      total: weekly.length
    };
  }, [logs]);
  function share() {
    const text = "Minha semana de bem-estar na MYRYRA 💜\n" +
      "Treinos: " + summary.workouts + " (" + summary.workoutMinutes + " min)\n" +
      "Meditações: " + summary.meditations + "\n" +
      "Pequenos passos, grandes conquistas.\nmyryra.com";
    if (navigator.share) void navigator.share({ title: "Meu progresso MYRYRA", text }).catch(() => {});
    else if (navigator.clipboard) void navigator.clipboard.writeText(text).then(() => setStatus("Resumo copiado.")).catch(() => setStatus("Não foi possível copiar."));
    else setStatus("Compartilhamento indisponível neste navegador.");
  }
  function askMika() {
    const prompt = "Atue como MIKA Saúde. Com base apenas nos seguintes indicadores agregados dos últimos 7 dias, ofereça sugestões gerais de bem-estar e pergunte o que o usuário gostaria de melhorar. Treinos: " + summary.workouts + ", minutos de treino: " + summary.workoutMinutes + ", meditações: " + summary.meditations + ", média de sono quando registrada: " + (summary.sleepAverage || "não informada") + " horas. Não faça diagnósticos ou prescrição médica, nutricional ou de exercício de risco. Não trate ausência de registros como falta de atividade. Solicite autorização antes de propor mudanças na Agenda.";
    try { sessionStorage.setItem("myryra:myka:health-handoff", prompt); navigateTo("vyra-ai"); }
    catch { setStatus("Não foi possível abrir a MIKA."); }
  }
  return <section className="space-y-4 rounded-2xl border border-violet-400/20 bg-slate-900/60 p-4 sm:p-5">
    <div><p className="text-xs font-semibold uppercase tracking-widest text-violet-300">MYRYRA Saúde · Evolução</p><h3 className="mt-1 text-lg font-semibold text-white">Seu progresso, no seu ritmo</h3><p className="mt-1 text-sm text-slate-300">Resumo dos registros dos últimos 7 dias. Não é uma avaliação clínica nem um score de saúde.</p></div>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {[
        ["Treinos", String(summary.workouts), summary.workoutMinutes + " min registrados"],
        ["Meditações", String(summary.meditations), "sessões registradas"],
        ["Sono médio", summary.sleepAverage ? summary.sleepAverage + " h" : "—", "entre noites registradas"],
        ["Refeições", String(summary.mealCount), "registros da semana"],
        ["Último peso", summary.latestWeight == null ? "—" : summary.latestWeight + " kg", "medição registrada"],
        ["Registros", String(summary.total), "na última semana"]
      ].map(([title,value,detail]) => <div key={title} className="rounded-xl border border-white/10 bg-slate-950/50 p-3"><p className="text-xs text-slate-400">{title}</p><p className="mt-1 text-xl font-semibold text-white">{value}</p><p className="mt-1 text-xs text-slate-400">{detail}</p></div>)}
    </div>
    <div className="flex flex-wrap gap-2"><button type="button" onClick={askMika} className="rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-500">Conversar com a MIKA sobre minha evolução</button><button type="button" onClick={share} className="rounded-xl border border-violet-400/40 px-4 py-3 text-sm text-violet-100 hover:bg-violet-600/20">Compartilhar conquistas</button></div>
    <p className="text-xs leading-5 text-slate-400">O compartilhamento inclui apenas quantidade e duração de treinos e meditações. Peso, sono, refeições, observações e limitações não são compartilhados. Você decide quando compartilhar.</p>
    {status && <p role="status" className="text-sm text-violet-200">{status}</p>}
  </section>;
}
