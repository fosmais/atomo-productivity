export type TimeInterval = {
  start: Date;
  end: Date;
};

export type AvailabilityResult = {
  available: TimeInterval[];
  blocked: TimeInterval[];
};

export function calculateAvailability(
  window: TimeInterval,
  blockedIntervals: TimeInterval[]
): AvailabilityResult {
  const windowStart = window.start.getTime();
  const windowEnd = window.end.getTime();

  if (
    !Number.isFinite(windowStart) ||
    !Number.isFinite(windowEnd) ||
    windowStart >= windowEnd
  ) {
    throw new Error("Janela de planejamento inválida.");
  }

  const normalized = blockedIntervals
    .map((interval) => ({
      start: Math.max(
        windowStart,
        interval.start.getTime()
      ),
      end: Math.min(
        windowEnd,
        interval.end.getTime()
      ),
    }))
    .filter(
      (interval) =>
        Number.isFinite(interval.start) &&
        Number.isFinite(interval.end) &&
        interval.start < interval.end
    )
    .sort((a, b) => a.start - b.start);

  const merged: Array<{ start: number; end: number }> = [];

  for (const interval of normalized) {
    const last = merged[merged.length - 1];

    if (last && interval.start <= last.end) {
      last.end = Math.max(last.end, interval.end);
    } else {
      merged.push({ ...interval });
    }
  }

  const available: TimeInterval[] = [];
  let cursor = windowStart;

  for (const interval of merged) {
    if (cursor < interval.start) {
      available.push({
        start: new Date(cursor),
        end: new Date(interval.start),
      });
    }

    cursor = Math.max(cursor, interval.end);
  }

  if (cursor < windowEnd) {
    available.push({
      start: new Date(cursor),
      end: new Date(windowEnd),
    });
  }

  return {
    available,
    blocked: merged.map((interval) => ({
      start: new Date(interval.start),
      end: new Date(interval.end),
    })),
  };
}
