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

/** A lesson must teach before assessing; answers are evaluated deterministically. */
export interface LearningExercise {
  id: string;
  prompt: string;
  choices: readonly string[];
  correctChoice: number;
  explanation: string;
}
export interface InteractiveLearningLesson {
  lessonId: string;
  introduction: string;
  explanation: string;
  workedExample: string;
  exercises: readonly LearningExercise[];
}
export interface ExerciseAnswer {
  exerciseId: string;
  choice: number;
}
export interface LearningAssessment {
  score: number;
  correct: number;
  total: number;
  passed: boolean;
  feedback: Array<{ exerciseId: string; correct: boolean; explanation: string }>;
}
export function validateInteractiveLesson(lesson: InteractiveLearningLesson): InteractiveLearningLesson {
  if (!lesson.lessonId.trim() || !lesson.introduction.trim() || !lesson.explanation.trim() || !lesson.workedExample.trim())
    throw new Error("Learning lesson requires an introduction, explanation and worked example");
  if (!lesson.exercises.length || lesson.exercises.length > 20)
    throw new Error("Learning lesson must contain 1 to 20 exercises");
  const ids = new Set<string>();
  for (const exercise of lesson.exercises) {
    if (!exercise.id.trim() || ids.has(exercise.id) || !exercise.prompt.trim() || !exercise.explanation.trim())
      throw new Error("Invalid or duplicate exercise");
    if (exercise.choices.length < 2 || exercise.choices.length > 6 || exercise.choices.some(choice => !choice.trim()))
      throw new Error("Each exercise must have 2 to 6 nonempty choices");
    if (!Number.isInteger(exercise.correctChoice) || exercise.correctChoice < 0 || exercise.correctChoice >= exercise.choices.length)
      throw new Error("Invalid exercise answer key");
    ids.add(exercise.id);
  }
  return lesson;
}
export function assessInteractiveLesson(
  lesson: InteractiveLearningLesson,
  answers: readonly ExerciseAnswer[],
  passThreshold = 70
): LearningAssessment {
  validateInteractiveLesson(lesson);
  if (!Number.isFinite(passThreshold) || passThreshold < 0 || passThreshold > 100)
    throw new Error("Invalid pass threshold");
  const answerMap = new Map<string, number>();
  const exercisesById = new Map(lesson.exercises.map(exercise => [exercise.id, exercise] as const));
  for (const answer of answers) {
    const exercise = exercisesById.get(answer.exerciseId);
    if (!exercise || answerMap.has(answer.exerciseId) || !Number.isInteger(answer.choice)
        || answer.choice < 0 || answer.choice >= exercise.choices.length)
      throw new Error("Unknown, duplicate or out-of-range exercise answer");
    answerMap.set(answer.exerciseId, answer.choice);
  }
  if (answerMap.size !== lesson.exercises.length) throw new Error("All exercises must be answered");
  const feedback = lesson.exercises.map(exercise => ({
    exerciseId: exercise.id,
    correct: answerMap.get(exercise.id) === exercise.correctChoice,
    explanation: exercise.explanation,
  }));
  const correct = feedback.filter(item => item.correct).length;
  const score = Math.round((correct / lesson.exercises.length) * 100);
  return { score, correct, total: lesson.exercises.length, passed: score >= passThreshold, feedback };
}

/**
 * Apply an assessed result to a lesson without mutating the original.
 * Persist the returned lesson only in an authenticated server workflow.
 * Failed attempts remain in progress and do not unlock completion rewards.
 */
export function applyLearningAssessment(
  lesson: Lesson,
  assessment: LearningAssessment,
  passThreshold = 70
): Lesson {
  if (!lesson.id.trim() || !lesson.goalId.trim()) throw new Error("Invalid lesson identity");
  // Validate the complete grading decision even when this lesson is already complete.
  // Never accept a caller-supplied passed flag that contradicts the actual score.
  planLearningNextStep(assessment, passThreshold);
  if (lesson.status === "completed") return lesson;
  if (!Number.isInteger(assessment.score) || assessment.score < 0 || assessment.score > 100)
    throw new Error("Invalid assessment score");
  if (!Number.isInteger(assessment.correct) || !Number.isInteger(assessment.total)
      || assessment.total < 1 || assessment.correct < 0 || assessment.correct > assessment.total
      || assessment.score !== Math.round(assessment.correct / assessment.total * 100))
    throw new Error("Inconsistent assessment result");
  return {
    ...lesson,
    status: assessment.passed ? "completed" : "in_progress",
    score: assessment.score,
  };
}

/**
 * Build an actionable next step from a server-graded attempt.
 * Only a trusted server assessment should be passed here; never use a
 * client-provided score to unlock a lesson or issue MYRA rewards.
 */
export interface LearningNextStep {
  action: "retry" | "advance";
  message: string;
  reviewExerciseIds: string[];
  suggestedReviewMinutes: number;
}
export function planLearningNextStep(assessment: LearningAssessment, passThreshold = 70): LearningNextStep {
  if (!Number.isFinite(passThreshold) || passThreshold < 0 || passThreshold > 100)
    throw new Error("Invalid pass threshold");
  if (!Number.isInteger(assessment.total) || assessment.total < 1
      || !Number.isInteger(assessment.correct) || assessment.correct < 0
      || assessment.correct > assessment.total
      || !Number.isInteger(assessment.score)
      || assessment.score !== Math.round(assessment.correct / assessment.total * 100)
      || typeof assessment.passed !== "boolean"
      || assessment.feedback.length !== assessment.total
      || assessment.feedback.filter(item => item.correct).length !== assessment.correct
      || new Set(assessment.feedback.map(item => item.exerciseId)).size !== assessment.total
      || assessment.feedback.some(item => !item.exerciseId.trim() || !item.explanation.trim()))
    throw new Error("Invalid learning assessment");
  // Passing is a decision made by the trusted grading service. It must
  // be consistent with the configured threshold, not an arbitrary flag.
  if (assessment.passed !== (assessment.score >= passThreshold))
    throw new Error("Inconsistent pass decision");
  const reviewExerciseIds = assessment.feedback.filter(item => !item.correct).map(item => item.exerciseId);
  if (!assessment.passed)
    return {
      action: "retry",
      message: "Vamos revisar os conceitos das questões que precisam de reforço antes de tentar novamente.",
      reviewExerciseIds,
      suggestedReviewMinutes: Math.min(40, Math.max(10, reviewExerciseIds.length * 10)),
    };
  return {
    action: "advance",
    message: reviewExerciseIds.length
      ? "Você concluiu a avaliação. Revise os pontos indicados antes da próxima aula."
      : "Você concluiu a avaliação. Vamos avançar para o próximo desafio.",
    reviewExerciseIds,
    suggestedReviewMinutes: reviewExerciseIds.length ? 10 : 0,
  };
}
