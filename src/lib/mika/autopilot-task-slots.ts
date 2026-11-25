import {findFreeSlots,type TimeInterval} from "./autopilot-slots";
import {rankMikaCandidates,type DecisionCandidate} from "./decision-engine";
/** Proposes placements only; does not mutate calendars or complete dependencies. */
export function proposeTaskSlots(window:TimeInterval,busy:readonly TimeInterval[],tasks:readonly DecisionCandidate[],completed:readonly string[],now:number){
  const slots=findFreeSlots(window,busy,1).map(s=>({...s,start:Math.max(s.start,now)})).filter(s=>s.end>s.start);
  const ranked=rankMikaCandidates(tasks,completed,Math.floor(Math.max(0,...slots.map(s=>s.end-s.start))/60000),now);
  const byId=new Map(tasks.map(t=>[t.id,t]));
  return ranked.flatMap(r=>{
    const t=byId.get(r.id)!;
    const deadline=t.dueAt===undefined?Infinity:Date.parse(t.dueAt);
    const duration=t.durationMinutes*60000;
    const slot=slots.find(s=>s.start+duration<=s.end&&s.start+duration<=deadline);
    if(!slot)return [];
    const start=slot.start;slot.start+=duration;
    return [{id:t.id,start,end:slot.start,requiresApproval:true as const}];
  });
}
