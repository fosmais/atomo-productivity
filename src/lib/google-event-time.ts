import { fromZonedTime } from "date-fns-tz";

export type GoogleEventTime = {
  start: string | null;
  end: string | null;
  calendarTimeZone?: string | null;
};

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function parseGoogleDate(
  value: string,
  timeZone: string | null | undefined
): Date {
  if (!DATE_ONLY.test(value)) {
    return new Date(value);
  }

  if (!timeZone) {
    throw new Error(
      "Evento de dia inteiro sem fuso horario do calendario."
    );
  }

  return fromZonedTime(`${value}T00:00:00`, timeZone);
}

export function getGoogleEventInterval(
  event: GoogleEventTime
): { start: Date; end: Date } | null {
  if (!event.start || !event.end) {
    throw new Error(
      "Evento do Google Calendar sem inicio ou fim. Planejamento interrompido por seguranca."
    );
  }

  const start = parseGoogleDate(
    event.start,
    event.calendarTimeZone
  );

  const end = parseGoogleDate(
    event.end,
    event.calendarTimeZone
  );

  if (
    !Number.isFinite(start.getTime()) ||
    !Number.isFinite(end.getTime()) ||
    start >= end
  ) {
    throw new Error(
      "Intervalo invalido no Google Calendar. Planejamento interrompido por seguranca."
    );
  }

  return { start, end };
}