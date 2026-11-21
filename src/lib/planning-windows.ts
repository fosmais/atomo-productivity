import { TZDate } from "@date-fns/tz";

import type { PlanningPreferences } from
  "@/lib/planning-preferences";

import type { TimeInterval } from
  "@/lib/availability-engine";

export function generatePlanningWindows(
  preferences: PlanningPreferences,
  from: Date,
  numberOfDays = 7
): TimeInterval[] {
  if (
    !Number.isInteger(numberOfDays) ||
    numberOfDays < 1 ||
    numberOfDays > 31 ||
    !Number.isFinite(from.getTime())
  ) {
    throw new Error("Período de planejamento inválido.");
  }

  const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

  if (
    !timePattern.test(preferences.startTime) ||
    !timePattern.test(preferences.endTime) ||
    preferences.startTime >= preferences.endTime
  ) {
    throw new Error("Horários de planejamento inválidos.");
  }

  const [startHour, startMinute] =
    preferences.startTime.split(":").map(Number);

  const [endHour, endMinute] =
    preferences.endTime.split(":").map(Number);

  const localStart = new TZDate(
    from.getTime(),
    preferences.timeZone
  );

  const windows: TimeInterval[] = [];

  for (let offset = 0; offset < numberOfDays; offset++) {
    const day = new TZDate(
      localStart.getFullYear(),
      localStart.getMonth(),
      localStart.getDate() + offset,
      0,
      0,
      0,
      preferences.timeZone
    );

    if (!preferences.weekdays.includes(day.getDay())) {
      continue;
    }

    const start = new TZDate(
      day.getFullYear(),
      day.getMonth(),
      day.getDate(),
      startHour,
      startMinute,
      0,
      preferences.timeZone
    );

    const end = new TZDate(
      day.getFullYear(),
      day.getMonth(),
      day.getDate(),
      endHour,
      endMinute,
      0,
      preferences.timeZone
    );

    const effectiveStart = Math.max(
      start.getTime(),
      from.getTime()
    );

    if (effectiveStart >= end.getTime()) {
      continue;
    }

    windows.push({
      start: new Date(effectiveStart),
      end: new Date(end.getTime()),
    });
  }

  return windows;
}
