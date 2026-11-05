"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useVyraNavigation } from "./vyra-module-context";
import ExerciseMovementDiagram from "./exercise-movement-diagram";

type Level = "Iniciante" | "Intermediário" | "Avançado";
type Group = "Peito" | "Costas" | "Braços" | "Ombros" | "Pernas" | "Abdômen";
type Exercise = { name: string; group: Group; equipment: string; cue: string; icon: string };
const exercises: Exercise[] = [
  { name: "Supino máquina", group: "Peito", equipment: "Máquina", cue: "Mantenha os ombros apoiados e empurre sem travar os cotovelos.", icon: "🏋️" },
  { name: "Crucifixo máquina", group: "Peito", equipment: "Máquina", cue: "Faça o movimento controlado, sem forçar a amplitude.", icon: "💪" },
  { name: "Flexão inclinada", group: "Peito", equipment: "Banco ou apoio", cue: "Mantenha o tronco alinhado e use apoio estável.", icon: "🤸" },
  { name: "Puxada frontal", group: "Costas", equipment: "Polia", cue: "Puxe à frente do peito sem inclinar excessivamente o tronco.", icon: "🏋️" },
  { name: "Remada sentada", group: "Costas", equipment: "Máquina", cue: "Mantenha a coluna neutra e aproxime os cotovelos do corpo.", icon: "🚣" },
  { name: "Rosca bíceps", group: "Braços", equipment: "Halteres", cue: "Evite balançar o tronco e controle a descida.", icon: "💪" },
  { name: "Tríceps na polia", group: "Braços", equipment: "Polia", cue: "Mantenha os cotovelos próximos ao corpo.", icon: "🏋️" },
  { name: "Elevação lateral", group: "Ombros", equipment: "Halteres", cue: "Eleve os braços com controle e sem compensar com o tronco.", icon: "🙆" },
  { name: "Desenvolvimento máquina", group: "Ombros", equipment: "Máquina", cue: "Ajuste o assento e trabalhe em amplitude confortável.", icon: "🏋️" },
  { name: "Leg press", group: "Pernas", equipment: "Máquina", cue: "Mantenha a lombar apoiada e evite estender totalmente os joelhos.", icon: "🦵" },
  { name: "Cadeira extensora", group: "Pernas", equipment: "Máquina", cue: "Ajuste o equipamento e execute sem movimentos bruscos.", icon: "🦵" },
  { name: "Prancha apoiada", group: "Abdômen", equipment: "Colchonete", cue: "Mantenha o tronco alinhado e respire normalmente.", icon: "🧘" },
  { name: "Dead bug", group: "Abdômen", equipment: "Colchonete", cue: "Movimente braços e pernas devagar, sem arquear a lombar.", icon: "🤸" }
];
const groups: Group[] = ["Peito", "Costas", "Braços", "Ombros", "Pernas", "Abdômen"];
const levels: Level[] = ["Iniciante", "Intermediário", "Avançado"];
export default function HealthExerciseLibrary() {
  const { navigateTo } = useVyraNavigation();
  const [group, setGroup] = useState<Group>("Peito");
  const [level, setLevel] = useState<Level>("Iniciante");
  const [done, setDone] = useState<string[]>([]);
  const [routine, setRoutine] = useState<"Livre" | "A" | "B" | "C">("Livre");
  const [loads, setLoads] = useState<Record<string,string>>({});
  const [reps, setReps] = useState<Record<string,string>>({});
  const [savingExercise, setSavingExercise] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [chartExercise, setChartExercise] = useState("");
  const [shareWithMika, setShareWithMika] = useState(false);
  const [instructionsOpen, setInstructionsOpen] = useState<string[]>([]);
  const [deletingEntry, setDeletingEntry] = useState<string | null>(null);
  const [history, setHistory] = useState<{id:string;exercise_name:string;weight_kg:number|null;repetitions:number|null;performed_on:string}[]>([]);
  useEffect(() => { let active = true; async function load() { const supabase = createClient(); const {data:{user}} = await supabase.auth.getUser(); if (!user) return; const {data} = await supabase.from("myryra_health_exercise_entries").select("id,exercise_name,weight_kg,repetitions,performed_on").eq("user_id",user.id).order("created_at",{ascending:false}).limit(100); if(active && data) setHistory(data); } void load(); return ()=>{active=false;}; }, []);
  async function completeExercise(item: Exercise) {
    if (done.includes(item.name)) return;
    const weightText = loads[item.name] ?? ""; const repsText = reps[item.name] ?? "";
    const weight = weightText.trim() === "" ? null : Number(weightText);
    const repetitions = repsText.trim() === "" ? null : Number(repsText);
    if ((weight !== null && (!Number.isFinite(weight) || weight < 0 || weight > 1000)) || (repetitions !== null && (!Number.isInteger(repetitions) || repetitions < 0 || repetitions > 100))) {setFeedback("Confira os valores de carga e repetições.");return;}
    setSavingExercise(item.name);setFeedback("");
    const supabase = createClient();const {data:{user}} = await supabase.auth.getUser();
    if(!user){setFeedback("Entre na sua conta para salvar o exercício.");setSavingExercise(null);return;}
    const {data,error}=await supabase.from("myryra_health_exercise_entries").insert({user_id:user.id,exercise_name:item.name,muscle_group:item.group,routine,level,weight_kg:weight,repetitions}).select("id,exercise_name,weight_kg,repetitions,performed_on").single();
    setSavingExercise(null);
    if(error){setFeedback("Não foi possível salvar. Tente novamente.");return;}
    setDone(old=>[...old,item.name]);setHistory(old=>[data,...old].slice(0,100));setFeedback(item.name+" salvo no seu histórico.");
  }
  async function deleteEntry(id:string) {
    setDeletingEntry(id);setFeedback("");
    const supabase=createClient();const {data:{user}}=await supabase.auth.getUser();
    if(!user){setFeedback("Entre na sua conta para excluir o registro.");setDeletingEntry(null);return;}
    const {error}=await supabase.from("myryra_health_exercise_entries").delete().eq("id",id).eq("user_id",user.id);
    setDeletingEntry(null);
    if(error){setFeedback("Não foi possível excluir este registro.");return;}
    setHistory(old=>old.filter(item=>item.id!==id));setFeedback("Registro excluído do histórico.");
  }
  const routineGroups: Record<"A" | "B" | "C", Group[]> = { A: ["Peito", "Ombros"], B: ["Costas", "Braços"], C: ["Pernas", "Abdômen"] };
  const filtered = useMemo(() => exercises.filter(item => routine === "Livre" ? item.group === group : routineGroups[routine].includes(item.group)), [group, routine]);
  const exerciseSummary = useMemo(() => { const totals = new Map<string,{count:number;maxWeight:number|null;latest:string}>(); for (const item of history) { const prev=totals.get(item.exercise_name); totals.set(item.exercise_name,{count:(prev?.count??0)+1,maxWeight:item.weight_kg===null?(prev?.maxWeight??null):Math.max(prev?.maxWeight??0,item.weight_kg),latest:prev?.latest??item.performed_on}); } return Array.from(totals.entries()).map(([name,stats])=>({name,...stats})); },[history]);
  const chartEntries = history.filter(item => item.exercise_name === (chartExercise || exerciseSummary[0]?.name) && item.weight_kg !== null).slice(0,12).reverse();
  const chartMax = Math.max(1,...chartEntries.map(item=>Number(item.weight_kg)));
  function askMikaAboutProgress() {
    if (!shareWithMika) {setFeedback("Autorize o compartilhamento do resumo antes de conversar com a MIKA.");return;}
    const summary = exerciseSummary.slice(0,12).map(item=>item.name+": "+item.count+" registros; maior carga registrada "+(item.maxWeight===null?"não informada":item.maxWeight+" kg")).join("\\n");
    const prompt = ["MIKA, quero revisar minha evolução na musculação. Faça perguntas sobre experiência, objetivo, técnica, limitações e recuperação antes de sugerir qualquer ajuste. Não prescreva aumentos automáticos de carga. Este é meu resumo voluntariamente compartilhado (últimos 100 registros):",summary||"Ainda não registrei exercícios.","Explique como acompanhar progressão de forma segura e quando procurar um profissional habilitado."].join("\\n");
    try {sessionStorage.setItem("myryra:myka:health-handoff",prompt.slice(0,3500));navigateTo("vyra-ai");}catch{setFeedback("Não foi possível abrir a MIKA.");}
  }
  const prescription = level === "Iniciante" ? "2 séries · 8–12 repetições" : level === "Intermediário" ? "2–3 séries · 8–12 repetições" : "3 séries · 8–12 repetições";
  return <section className="space-y-4 rounded-2xl border border-violet-400/25 bg-slate-900/70 p-4 sm:p-5">
    <div><p className="text-xs font-semibold uppercase tracking-widest text-violet-300">Musculação · Biblioteca de exercícios</p><h3 className="mt-1 text-xl font-semibold text-white">Monte sua ficha de treino</h3><p className="mt-2 text-sm text-slate-300">Explore exercícios por grupo muscular e experiência. As sugestões são exemplos educativos, não uma prescrição individual.</p></div>
    <div className="flex flex-wrap gap-2" role="group" aria-label="Divisão de treino">{(["Livre", "A", "B", "C"] as const).map(value => <button key={value} type="button" aria-pressed={routine === value} onClick={() => {setRoutine(value);setDone([]);}} className={"rounded-lg border px-3 py-2 text-sm "+(routine === value ? "border-violet-400 bg-violet-700/40 text-white" : "border-white/20 text-slate-300")}>{value === "Livre" ? "Por músculo" : "Treino "+value}</button>)}</div>
    {routine !== "Livre" && <p className="text-sm text-violet-200">{routine === "A" ? "A · Peito e ombros" : routine === "B" ? "B · Costas e braços" : "C · Pernas e abdômen"} · Exemplo de divisão semanal, ajustável pela MIKA.</p>}
    <div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1 text-sm text-slate-200">Grupo muscular<select disabled={routine !== "Livre"} aria-label="Grupo muscular" value={group} onChange={e => {setGroup(e.target.value as Group);setDone([]);}} className="block w-full rounded-xl border border-white/20 bg-slate-950 p-3 text-white">{groups.map(g=><option key={g} value={g}>{g}</option>)}</select></label><label className="space-y-1 text-sm text-slate-200">Nível<select aria-label="Nível do treino" value={level} onChange={e=>{setLevel(e.target.value as Level);setDone([]);}} className="block w-full rounded-xl border border-white/20 bg-slate-950 p-3 text-white">{levels.map(l=><option key={l} value={l}>{l}</option>)}</select></label></div>
    <div className="grid gap-3 md:grid-cols-2">{filtered.map(item => <article key={item.name} className="overflow-hidden rounded-xl border border-white/10 bg-slate-950/70"><ExerciseMovementDiagram group={item.group} name={item.name}/><div className="space-y-2 p-3"><h4 className="font-semibold text-white">{item.name}</h4><p className="text-xs text-violet-200">{prescription} · descanso de 60–90 s</p><p className="text-xs text-slate-300">{item.equipment} · {item.cue}</p><button type="button" aria-expanded={instructionsOpen.includes(item.name)} onClick={()=>setInstructionsOpen(old=>old.includes(item.name)?old.filter(x=>x!==item.name):[...old,item.name])} className="text-left text-xs font-semibold text-violet-200 underline">{instructionsOpen.includes(item.name)?"Ocultar orientações":"Como executar com segurança"}</button>{instructionsOpen.includes(item.name)&&<div className="space-y-1 rounded-lg border border-white/10 bg-slate-900 p-3 text-xs text-slate-200"><p><strong>Preparação:</strong> ajuste o equipamento ao seu corpo e escolha resistência confortável.</p><p><strong>Execução:</strong> {item.cue} Mantenha a respiração contínua, sem movimentos bruscos.</p><p><strong>Atenção:</strong> pare diante de dor, tontura ou falta de ar incomum. Solicite supervisão profissional para aprender a técnica específica.</p></div>}<div className="grid grid-cols-2 gap-2"><label className="text-xs text-slate-300">Carga (kg)<input inputMode="decimal" type="number" min="0" max="1000" step="0.5" placeholder="Opcional" value={loads[item.name] ?? ""} onChange={e=>setLoads(old=>({...old,[item.name]:e.target.value}))} className="mt-1 w-full rounded-lg border border-white/20 bg-slate-900 p-2 text-white"/></label><label className="text-xs text-slate-300">Repetições feitas<input inputMode="numeric" type="number" min="0" max="100" step="1" placeholder="Opcional" value={reps[item.name] ?? ""} onChange={e=>setReps(old=>({...old,[item.name]:e.target.value}))} className="mt-1 w-full rounded-lg border border-white/20 bg-slate-900 p-2 text-white"/></label></div><button type="button" aria-pressed={done.includes(item.name)} disabled={savingExercise === item.name || done.includes(item.name)} onClick={()=>void completeExercise(item)} className={"rounded-lg border px-3 py-2 text-sm "+(done.includes(item.name)?"border-emerald-400/50 bg-emerald-900/30 text-emerald-100":"border-violet-400/40 text-violet-100")}>{savingExercise === item.name ? "Salvando..." : done.includes(item.name)?"✓ Salvo no histórico":"Concluir e salvar exercício"}</button>{history.some(h=>h.exercise_name===item.name) && <p className="text-xs text-slate-400">Último registro: {(()=>{const h=history.find(h=>h.exercise_name===item.name)!;return [h.performed_on,h.weight_kg===null?"sem carga":h.weight_kg+" kg",h.repetitions===null?"sem repetições":h.repetitions+" rep."].join(" · ");})()}</p>}</div></article>)}</div>
    <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><h4 className="font-semibold text-white">Minha evolução na musculação</h4><p className="text-xs text-slate-400">{history.length} registros carregados · até 100 registros recentes</p></div><button type="button" onClick={()=>setHistoryExpanded(old=>!old)} className="rounded-lg border border-violet-400/40 px-3 py-2 text-sm text-violet-100">{historyExpanded?"Ocultar evolução":"Ver evolução"}</button></div>{historyExpanded && <div className="mt-3 space-y-2">{exerciseSummary.length===0?<p className="text-sm text-slate-400">Conclua um exercício para iniciar seu histórico.</p>:exerciseSummary.map(item=><div key={item.name} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 p-3"><span className="text-sm text-white">{item.name}</span><span className="text-xs text-slate-300">{item.count} registro(s) · maior carga registrada: {item.maxWeight===null?"não informada":item.maxWeight+" kg"}</span></div>)}</div>}{historyExpanded && exerciseSummary.length>0 && <div className="mt-4 space-y-3"><label className="block text-xs text-slate-300">Gráfico de carga por exercício<select value={chartExercise || exerciseSummary[0]?.name || ""} onChange={e=>setChartExercise(e.target.value)} className="mt-1 block w-full rounded-lg border border-white/20 bg-slate-900 p-2 text-white">{exerciseSummary.map(item=><option key={item.name} value={item.name}>{item.name}</option>)}</select></label>{chartEntries.length>0?<div role="img" aria-label="Gráfico de barras das últimas cargas registradas, da mais antiga para a mais recente" className="flex h-40 items-end gap-2 rounded-lg border border-white/10 bg-slate-900/50 p-3">{chartEntries.map(item=><div key={item.id} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1" style={{height:"100%"}}><span className="text-[10px] text-slate-200">{item.weight_kg}</span><div className="w-full max-w-10 rounded-t bg-violet-500" style={{height:Math.max(4,(Number(item.weight_kg)/chartMax)*105)+"px"}} title={item.performed_on+": "+item.weight_kg+" kg"}/><span className="text-[9px] text-slate-400">{item.performed_on.slice(5)}</span></div>)}</div>:<p className="text-xs text-slate-400">Registre uma carga para visualizar o gráfico.</p>}<p className="text-xs text-slate-400">Últimas 12 cargas entre os 100 registros recentes. Compare apenas execuções equivalentes; aumentar carga não é sempre necessário.</p></div>}</div>
    <div className="rounded-xl border border-violet-400/20 p-3"><h4 className="font-semibold text-white">Revisar evolução com a MIKA</h4><p className="mt-1 text-xs text-slate-300">A MIKA pode ajudar a interpretar o histórico, mas não substitui avaliação profissional. Somente um resumo de exercícios e cargas será enviado após sua autorização.</p><label className="mt-3 flex items-start gap-2 text-sm text-slate-200"><input type="checkbox" checked={shareWithMika} onChange={e=>setShareWithMika(e.target.checked)} className="mt-1 accent-violet-500"/><span>Autorizo compartilhar este resumo de musculação com a MIKA nesta conversa.</span></label><button type="button" disabled={!shareWithMika} onClick={askMikaAboutProgress} className="mt-3 rounded-lg bg-violet-600 px-4 py-2 font-semibold text-white disabled:opacity-50">Analisar minha evolução com a MIKA</button></div>
    {history.length>0 && <details className="rounded-xl border border-white/10 bg-slate-950/60 p-3"><summary className="cursor-pointer text-sm font-semibold text-white">Gerenciar registros de musculação ({history.length})</summary><div className="mt-3 max-h-72 space-y-2 overflow-y-auto">{history.slice(0,30).map(item=><div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 p-2"><div><p className="text-sm text-slate-200">{item.exercise_name}</p><p className="text-xs text-slate-400">{item.performed_on} · {item.weight_kg===null?"sem carga":item.weight_kg+" kg"} · {item.repetitions===null?"sem repetições":item.repetitions+" rep."}</p></div><button type="button" disabled={deletingEntry===item.id} onClick={()=>{if(window.confirm("Excluir este registro de musculação?"))void deleteEntry(item.id);}} className="rounded-lg border border-rose-400/30 px-3 py-2 text-xs text-rose-200 disabled:opacity-50">{deletingEntry===item.id?"Excluindo...":"Excluir"}</button></div>)}</div><p className="mt-2 text-xs text-slate-400">Exibindo até 30 registros recentes para gerenciamento.</p></details>}
    {feedback && <p role="status" className="text-sm text-violet-200">{feedback}</p>}
    <p className="text-xs text-slate-400">{done.length} de {filtered.length} exercícios marcados nesta visualização. Os exercícios concluídos são salvos no histórico da sua conta; a seleção atual da ficha não é salva. Os diagramas são conceituais; imagens técnicas específicas de cada exercício ainda precisam de validação.</p>
    <p className="text-xs text-slate-400">Interrompa se houver dor ou mal-estar. Para cargas, técnica, restrições e progressão individual, procure profissional de educação física habilitado.</p>
  </section>;
}
