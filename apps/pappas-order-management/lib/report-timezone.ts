const MELBOURNE_TIME_ZONE = 'Australia/Melbourne';

type MelbourneDateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function getMelbourneDateTimeParts(date: Date): MelbourneDateTimeParts {
  const parts = new Intl.DateTimeFormat('en-AU', {
    timeZone: MELBOURNE_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
    hour: value('hour'),
    minute: value('minute'),
    second: value('second'),
  };
}

function getMelbourneOffsetMilliseconds(instant: Date): number {
  const parts = getMelbourneDateTimeParts(instant);
  const wholeSecondInstant = Math.floor(instant.getTime() / 1_000) * 1_000;
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - wholeSecondInstant;
}

function parseDate(value: string): { year: number; month: number; day: number } {
  const [year, month, day] = value.split('-').map(Number);
  return { year, month, day };
}

function melbourneDateTimeToIso(dateString: string, boundary: 'start' | 'end'): string {
  const { year, month, day } = parseDate(dateString);
  const hour = boundary === 'start' ? 0 : 23;
  const minute = boundary === 'start' ? 0 : 59;
  const second = boundary === 'start' ? 0 : 59;
  const millisecond = boundary === 'start' ? 0 : 999;
  const wallClockMilliseconds = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
  let utcMilliseconds = wallClockMilliseconds;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    utcMilliseconds = wallClockMilliseconds - getMelbourneOffsetMilliseconds(new Date(utcMilliseconds));
  }

  return new Date(utcMilliseconds).toISOString();
}

export function toMelbourneRangeBoundaryIso(dateString: string, boundary: 'start' | 'end'): string {
  return melbourneDateTimeToIso(dateString, boundary);
}

export function formatDateInMelbourne(date: Date): string {
  const parts = getMelbourneDateTimeParts(date);
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

export function getTimeInMelbourne(date: Date): { hour: number; minute: number } {
  const parts = getMelbourneDateTimeParts(date);
  return { hour: parts.hour, minute: parts.minute };
}
