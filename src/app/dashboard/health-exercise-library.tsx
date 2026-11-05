"use client";

import { useMemo, useState } from "react";

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
  const [group, setGroup] = useState<Group>("Peito");
  const [level, setLevel] = useState<Level>("Iniciante");
  const [done, setDone] = useState<string[]>([]);
  const [routine, setRoutine] = useState<"Livre" | "A" | "B" | "C">("Livre");
  const [loads, setLoads] = useState<Record<string,string>>({});
  const [reps, setReps] = useState<Record<string,string>>({});
  const routineGroups: Record<"A" | "B" | "C", Group[]> = { A: ["Peito", "Ombros"], B: ["Costas", "Braços"], C: ["Pernas", "Abdômen"] };
  const filtered = useMemo(() => exercises.filter(item => routine === "Livre" ? item.group === group : routineGroups[routine].includes(item.group)), [group, routine]);
  const prescription = level === "Iniciante" ? "2 séries · 8–12 repetições" : level === "Intermediário" ? "2–3 séries · 8–12 repetições" : "3 séries · 8–12 repetições";
  return <section className="space-y-4 rounded-2xl border border-violet-400/25 bg-slate-900/70 p-4 sm:p-5">
    <div><p className="text-xs font-semibold uppercase tracking-widest text-violet-300">Musculação · Biblioteca de exercícios</p><h3 className="mt-1 text-xl font-semibold text-white">Monte sua ficha de treino</h3><p className="mt-2 text-sm text-slate-300">Explore exercícios por grupo muscular e experiência. As sugestões são exemplos educativos, não uma prescrição individual.</p></div>
    <div className="flex flex-wrap gap-2" role="group" aria-label="Divisão de treino">{(["Livre", "A", "B", "C"] as const).map(value => <button key={value} type="button" aria-pressed={routine === value} onClick={() => {setRoutine(value);setDone([]);}} className={"rounded-lg border px-3 py-2 text-sm "+(routine === value ? "border-violet-400 bg-violet-700/40 text-white" : "border-white/20 text-slate-300")}>{value === "Livre" ? "Por músculo" : "Treino "+value}</button>)}</div>
    {routine !== "Livre" && <p className="text-sm text-violet-200">{routine === "A" ? "A · Peito e ombros" : routine === "B" ? "B · Costas e braços" : "C · Pernas e abdômen"} · Exemplo de divisão semanal, ajustável pela MIKA.</p>}
    <div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1 text-sm text-slate-200">Grupo muscular<select disabled={routine !== "Livre"} aria-label="Grupo muscular" value={group} onChange={e => {setGroup(e.target.value as Group);setDone([]);}} className="block w-full rounded-xl border border-white/20 bg-slate-950 p-3 text-white">{groups.map(g=><option key={g} value={g}>{g}</option>)}</select></label><label className="space-y-1 text-sm text-slate-200">Nível<select aria-label="Nível do treino" value={level} onChange={e=>{setLevel(e.target.value as Level);setDone([]);}} className="block w-full rounded-xl border border-white/20 bg-slate-950 p-3 text-white">{levels.map(l=><option key={l} value={l}>{l}</option>)}</select></label></div>
    <div className="grid gap-3 md:grid-cols-2">{filtered.map(item => <article key={item.name} className="overflow-hidden rounded-xl border border-white/10 bg-slate-950/70"><div className="flex h-28 items-center justify-center bg-gradient-to-br from-violet-900/60 to-slate-800" aria-label={"Representação ilustrativa de "+item.name}><span role="img" aria-label="Ícone ilustrativo, não demonstra a técnica" className="text-5xl">{item.icon}</span></div><div className="space-y-2 p-3"><h4 className="font-semibold text-white">{item.name}</h4><p className="text-xs text-violet-200">{prescription} · descanso de 60–90 s</p><p className="text-xs text-slate-300">{item.equipment} · {item.cue}</p><div className="grid grid-cols-2 gap-2"><label className="text-xs text-slate-300">Carga (kg)<input inputMode="decimal" type="number" min="0" max="1000" step="0.5" placeholder="Opcional" value={loads[item.name] ?? ""} onChange={e=>setLoads(old=>({...old,[item.name]:e.target.value}))} className="mt-1 w-full rounded-lg border border-white/20 bg-slate-900 p-2 text-white"/></label><label className="text-xs text-slate-300">Repetições feitas<input inputMode="numeric" type="number" min="0" max="100" step="1" placeholder="Opcional" value={reps[item.name] ?? ""} onChange={e=>setReps(old=>({...old,[item.name]:e.target.value}))} className="mt-1 w-full rounded-lg border border-white/20 bg-slate-900 p-2 text-white"/></label></div><button type="button" aria-pressed={done.includes(item.name)} onClick={()=>setDone(old=>old.includes(item.name)?old.filter(x=>x!==item.name):[...old,item.name])} className={"rounded-lg border px-3 py-2 text-sm "+(done.includes(item.name)?"border-emerald-400/50 bg-emerald-900/30 text-emerald-100":"border-violet-400/40 text-violet-100")}>{done.includes(item.name)?"✓ Marcado como concluído":"Marcar exercício concluído"}</button></div></article>)}</div>
    <p className="text-xs text-slate-400">{done.length} de {filtered.length} exercícios marcados nesta visualização. As marcações, cargas e repetições desta ficha são temporárias e não são salvas no histórico. Os ícones são ilustrativos; imagens técnicas de execução serão adicionadas após validação.</p>
    <p className="text-xs text-slate-400">Interrompa se houver dor ou mal-estar. Para cargas, técnica, restrições e progressão individual, procure profissional de educação física habilitado.</p>
  </section>;
}
