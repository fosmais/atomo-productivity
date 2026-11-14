/** Pure validation used before a journey replan is persisted. */
export type ExistingJourneyMission = { id: string; title: string; status: string };
export type ProposedJourneyMission = { title: string; week: number };

export function validateReplan(
  existing: ExistingJourneyMission[],
  proposed: ProposedJourneyMission[],
): { completedIds: string[]; pendingIds: string[]; replacementTitles: string[] } {
  if (!Array.isArray(existing) || !Array.isArray(proposed)) throw new Error("Plano inválido.");
  if (existing.length > 104 || proposed.length < 1 || proposed.length > 104)
    throw new Error("O planejamento deve conter entre 1 e 104 missões.");
  const normalize = (value: string) => value.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ").toLowerCase();
  const completed = existing.filter(m => m.status === "completed");
  const pending = existing.filter(m => m.status !== "completed");
  if (existing.some(m => m.status !== "completed" && m.status !== "pending"))
    throw new Error("A jornada contém um estado de missão não suportado.");
  const seen = new Set(completed.map(m => normalize(m.title)));
  const titles: string[] = [];
  for (const mission of proposed) {
    if (typeof mission.title !== "string" || !mission.title.trim() || mission.title.length > 160 ||
        !Number.isInteger(mission.week) || mission.week < 1 || mission.week > 104)
      throw new Error("A proposta contém uma missão inválida.");
    const key = normalize(mission.title);
    if (seen.has(key)) throw new Error("A proposta repete uma missão concluída ou outra missão.");
    seen.add(key);
    titles.push(mission.title.trim());
  }
  return {
    completedIds: completed.map(m => m.id),
    pendingIds: pending.map(m => m.id),
    replacementTitles: titles,
  };
}
