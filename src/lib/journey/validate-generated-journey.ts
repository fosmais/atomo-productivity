import type { JourneyDraft, JourneyMission } from "./create-journey-draft";

type GeneratedMission = { title: string; week: number };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Validate model output as untrusted data. The model cannot set owner, status,
 * rewards, persistence identifiers, or confirmation flags.
 * This is a validation building block; it does not save or activate AI drafts.
 */
export function validateGeneratedJourneyMissions(
  output: unknown,
  base: JourneyDraft,
): JourneyMission[] {
  if (!isRecord(output) || !Array.isArray(output.missions)) {
    throw new Error("Resposta de jornadas inválida.");
  }
  const expectedCount = base.weeks * 2;
  if (output.missions.length !== expectedCount || expectedCount > 104) {
    throw new Error("Quantidade de missões inválida.");
  }
  const counts = new Map<number, number>();
  const missions: JourneyMission[] = [];
  for (const value of output.missions) {
    if (!isRecord(value) || typeof value.title !== "string" ||
        !Number.isInteger(value.week) || (value.week as number) < 1 ||
        (value.week as number) > base.weeks) {
      throw new Error("Missão inválida.");
    }
    const title = value.title.trim().replace(/\s+/g, " ");
    if (!title || title.length > 160 || /[\u0000-\u001f\u007f]/.test(title)) {
      throw new Error("Título de missão inválido.");
    }
    const week = value.week as number;
    const count = (counts.get(week) ?? 0) + 1;
    if (count > 2) throw new Error("Excesso de missões por semana.");
    counts.set(week, count);
    missions.push({ id: `week-${week}-${count === 1 ? "plan" : "review"}`, title, week, status: "pending" });
  }
  if (counts.size !== base.weeks || [...counts.values()].some((count) => count !== 2)) {
    throw new Error("Jornada incompleta.");
  }
  missions.sort((a, b) => a.week - b.week || a.id.localeCompare(b.id));
  return missions;
}
