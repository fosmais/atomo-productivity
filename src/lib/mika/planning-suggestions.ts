import { orderPlannerActions, type PlannerAction } from "./planner";
import { rankMikaCandidates, type DecisionCandidate } from "./decision-engine";
/** Select suggestions within a total time budget. Dependencies must already be completed; selection is not execution. */
export function suggestMikaActions(actions: readonly (PlannerAction & Omit<DecisionCandidate,"id"|"dependsOn">)[], completed: readonly string[], availableMinutes: number, now: number) {
  const done = new Set(completed);
  const pending = actions.filter(a=>!done.has(a.id));
  if (!pending.length) return [];
  orderPlannerActions(pending.map(a=>({...a,dependsOn:a.dependsOn.filter(id=>!done.has(id))})));
  const ranked = rankMikaCandidates(pending,completed,availableMinutes,now);
  const byId = new Map(pending.map(a=>[a.id,a]));
  let remaining = availableMinutes;
  return ranked.flatMap(r=>{
    const a=byId.get(r.id)!;
    if(a.durationMinutes>remaining) return [];
    remaining-=a.durationMinutes;
    return [{id:a.id,title:a.title,kind:a.kind,score:r.score,durationMinutes:a.durationMinutes,requiresApproval:true as const}];
  });
}
