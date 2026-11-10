/**
 * MYRYRA — MIKA Learning Engine (domain layer).
 * Pure functions: no database writes, calendar events, or AI calls.
 * An authenticated server action must persist results and obtain explicit
 * user consent before scheduling any calendar events.
 */
export type LearningLevel = "beginner" | "intermediate" | "advanced";
export type LessonStatus = "pending" | "in_progress" | "completed";
export interface LearningGoal {
  id: string;
  title: string;
  category: string;
  level: LearningLevel;
  minutesPerSession: number;
  sessionsPerWeek: number;
  weeks: number;
}
export interface Lesson {
  id: string;
  goalId: string;
  week: number;
  sequence: number;
  title: string;
  outcome: string;
  status: LessonStatus;
  score?: number;
}
export interface LearningProgress {
  completed: number;
  total: number;
  percent: number;
  averageScore: number | null;
  nextLesson: Lesson | null;
}
export function validateLearningGoal(goal: LearningGoal): LearningGoal {
  if (!goal.id.trim() || !goal.title.trim() || !goal.category.trim())
    throw new Error("Goal id, title and category are required");
  if (!["beginner", "intermediate", "advanced"].includes(goal.level))
    throw new Error("Invalid learning level");
  for (const [name, value, min, max] of [
    ["minutesPerSession", goal.minutesPerSession, 5, 180],
    ["sessionsPerWeek", goal.sessionsPerWeek, 1, 7],
    ["weeks", goal.weeks, 1, 52],
  ] as const) {
    if (!Number.isInteger(value) || value < min || value > max)
      throw new Error(`Invalid ${name}`);
  }
  return goal;
}
export function buildLearningOutline(
  goal: LearningGoal,
  topics: ReadonlyArray<{ title: string; outcome: string }>
): Lesson[] {
  validateLearningGoal(goal);
  if (!topics.length) throw new Error("At least one learning topic is required");
  const count = goal.weeks * goal.sessionsPerWeek;
  return Array.from({ length: count }, (_, index) => {
    const topic = topics[index % topics.length];
    return {
      id: `${goal.id}:lesson:${index + 1}`,
      goalId: goal.id,
      week: Math.floor(index / goal.sessionsPerWeek) + 1,
      sequence: index + 1,
      title: topic.title,
      outcome: topic.outcome,
      status: "pending" as const,
    };
  });
}
export function summarizeLearningProgress(lessons: readonly Lesson[]): LearningProgress {
  const completed = lessons.filter((lesson) => lesson.status === "completed");
  const scored = completed.filter((lesson) => typeof lesson.score === "number" && Number.isFinite(lesson.score) && lesson.score! >= 0 && lesson.score! <= 100);
  return {
    completed: completed.length,
    total: lessons.length,
    percent: lessons.length ? Math.round((completed.length / lessons.length) * 100) : 0,
    averageScore: scored.length
      ? Math.round(scored.reduce((sum, lesson) => sum + lesson.score!, 0) / scored.length)
      : null,
    nextLesson: lessons.find((lesson) => lesson.status !== "completed") ?? null,
  };
}
export function recommendLearningPace(progress: LearningProgress): "review" | "continue" | "advance" {
  if (progress.averageScore === null) return "continue";
  if (progress.averageScore < 70) return "review";
  return progress.averageScore >= 90 && progress.completed >= 3 ? "advance" : "continue";
}
export interface CalendarProposal {
  goalId: string;
  lessonId: string;
  durationMinutes: number;
  title: string;
  requiresUserApproval: true;
}
export function proposeLessonCalendarEntry(goal: LearningGoal, lesson: Lesson): CalendarProposal {
  validateLearningGoal(goal);
  if (lesson.goalId !== goal.id) throw new Error("Lesson does not belong to goal");
  return {
    goalId: goal.id,
    lessonId: lesson.id,
    durationMinutes: goal.minutesPerSession,
    title: `MIKA · ${lesson.title}`,
    requiresUserApproval: true,
  };
}
