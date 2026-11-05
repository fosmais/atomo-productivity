"use client";

type Group = "Peito" | "Costas" | "Braços" | "Ombros" | "Pernas" | "Abdômen";
const drawings: Record<Group,{start:[number,number,number,number];end:[number,number,number,number];arrow:string;caption:string}> = {
  Peito:{start:[52,92,88,92],end:[52,53,88,53],arrow:"Empurrar",caption:"Movimento de empurrar, com ombros estáveis"},
  Costas:{start:[52,42,88,42],end:[52,89,88,89],arrow:"Puxar",caption:"Puxar com controle, sem compensar o tronco"},
  Braços:{start:[49,96,87,96],end:[49,57,87,57],arrow:"Flexionar",caption:"Flexão ou extensão controlada dos cotovelos"},
  Ombros:{start:[51,91,88,91],end:[37,48,103,48],arrow:"Elevar",caption:"Elevar sem impulsionar com o tronco"},
  Pernas:{start:[48,101,93,101],end:[48,67,93,67],arrow:"Estender",caption:"Movimento de pernas dentro de amplitude confortável"},
  Abdômen:{start:[42,83,100,83],end:[42,67,100,67],arrow:"Estabilizar",caption:"Manter o tronco estável e respirar normalmente"}
};
export default function ExerciseMovementDiagram({group,name}:{group:Group;name:string}) {
  const d=drawings[group];
  return <div className="rounded-lg border border-violet-400/10 bg-gradient-to-br from-violet-950/70 to-slate-800/80 p-3">
    <svg viewBox="0 0 180 128" role="img" aria-label={"Diagrama conceitual de movimento para "+name} className="mx-auto h-32 w-full max-w-xs">
      <title>{"Ilustração esquemática: "+name}</title>
      <circle cx="70" cy="23" r="11" fill="none" stroke="#d8b4fe" strokeWidth="3"/>
      <path d="M70 35 L70 81 M70 47 L45 69 M70 47 L96 69 M70 81 L51 113 M70 81 L90 113" fill="none" stroke="#c4b5fd" strokeWidth="4" strokeLinecap="round"/>
      <line x1={d.start[0]} y1={d.start[1]} x2={d.start[2]} y2={d.start[3]} stroke="#64748b" strokeWidth="7" strokeLinecap="round"/>
      <line x1={d.end[0]} y1={d.end[1]} x2={d.end[2]} y2={d.end[3]} stroke="#a78bfa" strokeWidth="5" strokeLinecap="round" strokeDasharray="5 4"/>
      <path d="M130 82 L130 42 M122 50 L130 42 L138 50" fill="none" stroke="#fbbf24" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
      <text x="130" y="99" textAnchor="middle" fill="#e9d5ff" fontSize="11">{d.arrow}</text>
    </svg>
    <p className="text-center text-xs text-violet-100">{d.caption}</p>
    <p className="mt-1 text-center text-[10px] text-slate-400">Esquema conceitual do grupo muscular; não demonstra a execução específica.</p>
  </div>;
}
