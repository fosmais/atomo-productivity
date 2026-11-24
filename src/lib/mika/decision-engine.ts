/** Deterministic ranking of eligible actions; never executes or authorizes them. */
export type DecisionCandidate = { id: string; importance: number; dueAt?: string; durationMinutes: number; dependsOn: string[] };
export function rankMikaCandidates(candidates: readonly DecisionCandidate[], completed: readonly string[], availableMinutes: number, now: number) {
  if (!Number.isFinite(now) || !Number.isFinite(availableMinutes) || availableMinutes < 0 || candidates.length > 100) throw new Error("invalid_context");
  const done = new Set(completed), ids = new Set<string>();
  return candidates.map(c => {
    if (!c.id || ids.has(c.id) || !Number.isInteger(c.importance) || c.importance < 1 || c.importance > 5 || !Number.isInteger(c.durationMinutes) || c.durationMinutes < 1 || !Array.isArray(c.dependsOn)) throw new Error("invalid_candidate");
    ids.add(c.id);
    const due = c.dueAt === undefined ? Infinity : Date.parse(c.dueAt);
    if (Number.isNaN(due)) throw new Error("invalid_deadline");
    const urgency = due <= now ? 50 : due <= now + 86400000 ? 30 : due <= now + 604800000 ? 10 : 0;
    return { id:c.id, score:c.importance*10+urgency, eligible:!done.has(c.id)&&c.durationMinutes<=availableMinutes&&c.dependsOn.every(id=>id!==c.id&&done.has(id)) };
  }).filter(c=>c.eligible).sort((a,b)=>b.score-a.score||(a.id<b.id?-1:a.id>b.id?1:0));
}
