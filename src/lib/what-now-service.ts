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
};

export async function getWhatNowRecommendation(
  now: Date = new Date()
): Promise<WhatNowResult> {
  if (!Number.isFinite(now.getTime())) {
    throw new Error("Data atual inválida.");
  }

  const [availability, tasks, googleBlocked] =
    await Promise.all([
      getCloudAvailability(now, 1),
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

  return {
    recommendation,
    missingDurationCount: tasks.missingDuration.length,
    readyTaskCount: tasks.ready.length,
    checkedAt: new Date(now.getTime()),
  };
}