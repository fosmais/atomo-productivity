/** Pure planning only: no persistence, authorization or execution. */
export type PlannerAction = { id: string; kind: "create_task" | "create_event" | "reserve_focus"; title: string; dependsOn: string[]; startsAt?: string; endsAt?: string };
export function orderPlannerActions(actions: readonly PlannerAction[]): PlannerAction[] {
  if (!Array.isArray(actions) || actions.length < 1 || actions.length > 20) throw new Error("invalid_plan_size");
  const byId = new Map<string, PlannerAction>();
  for (const a of actions) {
    if (!a.id || byId.has(a.id) || !a.title.trim() || a.title.length > 200 || !["create_task","create_event","reserve_focus"].includes(a.kind) || !Array.isArray(a.dependsOn)) throw new Error("invalid_action");
    if (a.kind !== "create_task" || a.startsAt !== undefined || a.endsAt !== undefined) {
      const start = Date.parse(a.startsAt ?? ""), end = Date.parse(a.endsAt ?? "");
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) throw new Error("invalid_interval");
    }
    byId.set(a.id,a);
  }
  const ordered: PlannerAction[] = [], visiting = new Set<string>(), done = new Set<string>();
  function visit(id: string) {
    if (done.has(id)) return;
    if (visiting.has(id)) throw new Error("cyclic_dependency");
    const a = byId.get(id);
    if (!a) throw new Error("missing_dependency");
    visiting.add(id);
    for (const dep of a.dependsOn) visit(dep);
    visiting.delete(id); done.add(id); ordered.push({...a,dependsOn:[...a.dependsOn]});
  }
  for (const a of actions) visit(a.id);
  const timed = ordered.filter(a=>a.startsAt && a.endsAt).sort((a,b)=>Date.parse(a.startsAt!)-Date.parse(b.startsAt!));
  for(let i=1;i<timed.length;i++) if(Date.parse(timed[i].startsAt!)<Date.parse(timed[i-1].endsAt!)) throw new Error("overlapping_actions");
  return ordered;
}
