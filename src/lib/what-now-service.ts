import {
  calculateAvailability,
  type TimeInterval,
} from "./availability-engine";

import { getCloudAvailability } from "./cloud-availability";
import { getCloudTasksForScheduling } from "./cloud-task-scheduling";
import { getGoogleBusyIntervals } from "./google-busy-intervals";

import {
  recommendWhatNow,
  type WhatNowRecommendation,
} from "./what-now-engine";

export type WhatNowResult = {
  recommendation: WhatNowRecommendation | null;
  missingDurationCount: number;
  readyTaskCount: number;
  checkedAt: Date;
  nextOpportunity: { title: string; taskId: string; durationMinutes: number; start: Date } | null;
};

export async function getWhatNowRecommendation(
  now: Date = new Date()
): Promise<WhatNowResult> {
  if (!Number.isFinite(now.getTime())) {
    throw new Error("Data atual inválida.");
  }

  const [availability, tasks, googleBlocked] =
    await Promise.all([
      getCloudAvailability(now, 7),
      getCloudTasksForScheduling(),
      getGoogleBusyIntervals(),
    ]);

  const availableIntervals: TimeInterval[] =
    availability.flatMap((day) => day.available);

  const freeIntervals = availableIntervals.flatMap(
    (interval) =>
      calculateAvailability(
        interval,
        googleBlocked
      ).available
  );

  const recommendation = recommendWhatNow(
    tasks.ready,
    freeIntervals,
    now
  );

  // Only offer a future slot when the entire task fits in a valid free interval.
  const candidates = freeIntervals.flatMap((interval) => {
    const startMs = Math.max(interval.start.getTime(), now.getTime());
    const endMs = interval.end.getTime();
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return [];

    return tasks.ready
      .filter((task) =>
        Number.isFinite(task.durationMinutes) &&
        task.durationMinutes >= 5 &&
        Number.isFinite(task.priority) &&
        startMs + task.durationMinutes * 60_000 <= endMs
      )
      .map((task) => ({
        title: task.title,
        taskId: task.id,
        durationMinutes: task.durationMinutes,
        start: new Date(startMs),
        priority: task.priority,
      }));
  });
  candidates.sort((a, b) =>
    a.start.getTime() - b.start.getTime() ||
    b.priority - a.priority ||
    a.durationMinutes - b.durationMinutes ||
    a.taskId.localeCompare(b.taskId)
  );
  const nextOpportunity = recommendation ? null : candidates[0] ?? null;

  return {
    recommendation,
    nextOpportunity,
    missingDurationCount: tasks.missingDuration.length,
    readyTaskCount: tasks.ready.length,
    checkedAt: new Date(now.getTime()),
  };
}