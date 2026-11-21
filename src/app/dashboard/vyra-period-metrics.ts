export type VyraPeriod = "day" | "week" | "month" | "year";

export type CompletionRecord = {
  completed_at: string | null;
};

export type PeriodMetrics = {
  current: number;
  previous: number;
  difference: number;
  percentageChange: number | null;
  currentStart: string;
  previousStart: string;
};

const TIME_ZONE = "America/Sao_Paulo";

// Início conhecido da coleta de datas de conclusão.
// Períodos anteriores podem conter tarefas concluídas sem completed_at.
export const VYRA_HISTORY_START = "2026-10-25";

function dateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const value = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value);

  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
  };
}

function dayNumber(year: number, month: number, day: number) {
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
}

function periodKey(date: Date, period: VyraPeriod): number {
  const { year, month, day } = dateParts(date);
  const number = dayNumber(year, month, day);

  if (period === "day") return number;

  if (period === "week") {
    const weekday = new Date(number * 86400000).getUTCDay();
    return number - ((weekday + 6) % 7);
  }

  if (period === "month") return year * 12 + month - 1;

  return year;
}

function periodLabel(key: number, period: VyraPeriod): string {
  if (period === "year") return String(key);

  if (period === "month") {
    const year = Math.floor(key / 12);
    const month = (key % 12) + 1;
    return `${year}-${String(month).padStart(2, "0")}`;
  }

  return new Date(key * 86400000).toISOString().slice(0, 10);
}

export function calculatePeriodMetrics(
  tasks: CompletionRecord[],
  period: VyraPeriod,
  now = new Date()
): PeriodMetrics {
  const currentKey = periodKey(now, period);
  const previousKey = currentKey - 1;

  let current = 0;
  let previous = 0;

  for (const task of tasks) {
    if (!task.completed_at) continue;

    const completedDate = new Date(task.completed_at);
    if (Number.isNaN(completedDate.getTime())) continue;

    const key = periodKey(completedDate, period);

    if (key === currentKey) current++;
    if (key === previousKey) previous++;
  }

  return {
    current,
    previous,
    difference: current - previous,
    percentageChange:
      previous > 0
        ? Math.round(((current - previous) / previous) * 100)
        : null,
    currentStart: periodLabel(currentKey, period),
    previousStart: periodLabel(previousKey, period),
  };
}
export type CompletionSeriesPoint = {
  label: string;
  completed: number | null;
  periodStart: string;
  coverage: HistoryCoverage;
};

export function calculateCompletionSeries(
  tasks: CompletionRecord[],
  period: VyraPeriod,
  now = new Date()
): CompletionSeriesPoint[] {
  const currentKey = periodKey(now, period);

  const length =
    period === "day" ? 7 :
    period === "week" ? 8 :
    period === "month" ? 12 : 5;

  const counts = new Map<number, number>();

  for (const task of tasks) {
    if (!task.completed_at) continue;

    const date = new Date(task.completed_at);
    if (Number.isNaN(date.getTime())) continue;

    const key = periodKey(date, period);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return Array.from({ length }, (_, index) => {
    const key = currentKey - (length - 1 - index);
    const start = periodLabel(key, period);

    const label =
      period === "day"
        ? start.slice(5)
        : period === "week"
          ? start.slice(5)
          : period === "month"
            ? start.slice(5)
            : start;
    const coverage = getHistoryCoverage(period, key - currentKey, now);

    return {
      label,
      completed: coverage === "unavailable" ? null : counts.get(key) ?? 0,
      periodStart: start,
      coverage,
    };
  });
}
export type HistoryCoverage =
  | "available"
  | "partial"
  | "unavailable";

function periodStartDay(key: number, period: VyraPeriod): number {
  if (period === "day" || period === "week") return key;

  if (period === "month") {
    const year = Math.floor(key / 12);
    const month = (key % 12) + 1;
    return dayNumber(year, month, 1);
  }

  return dayNumber(key, 1, 1);
}

function nextPeriodStartDay(key: number, period: VyraPeriod): number {
  if (period === "day") return key + 1;
  if (period === "week") return key + 7;
  return periodStartDay(key + 1, period);
}

export function getHistoryCoverage(
  period: VyraPeriod,
  offset = 0,
  now = new Date()
): HistoryCoverage {
  const key = periodKey(now, period) + offset;
  const start = periodStartDay(key, period);
  const endExclusive = nextPeriodStartDay(key, period);

  const [year, month, day] = VYRA_HISTORY_START
    .split("-")
    .map(Number);

  const historyStart = dayNumber(year, month, day);

  if (endExclusive <= historyStart) return "unavailable";
  if (start < historyStart) return "partial";

  return "available";
}
export function canCompareHistory(
  period: VyraPeriod,
  now = new Date()
): boolean {
  return (
    getHistoryCoverage(period, 0, now) === "available" &&
    getHistoryCoverage(period, -1, now) === "available"
  );
}