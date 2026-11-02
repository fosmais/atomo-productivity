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

  const candidates = freeIntervals.flatMap(interval => tasks.ready.filter(task => task.durationMinutes >= 5 && interval.end.getTime() - Math.max(interval.start.getTime(), now.getTime()) >= task.durationMinutes * 60000).map(task => ({ title: task.title, taskId: task.id, durationMinutes: task.durationMinutes, start: new Date(Math.max(interval.start.getTime(), now.getTime())), priority: task.priority })));
  candidates.sort((a, b) => a.start.getTime() - b.start.getTime() || b.priority - a.priority);
  const nextOpportunity = recommendation ? null : candidates[0] ?? null;

  return {
    recommendation,
    nextOpportunity,
    missingDurationCount: tasks.missingDuration.length,
    readyTaskCount: tasks.ready.length,
    checkedAt: new Date(now.getTime()),
  };
}