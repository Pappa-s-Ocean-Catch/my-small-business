const MELBOURNE_TIME_ZONE = 'Australia/Melbourne';
function getMelbourneDateTimeParts(date) {
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
  const value = (type) => Number(parts.find((part) => part.type === type)?.value);
  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
    hour: value('hour'),
    minute: value('minute'),
    second: value('second'),
  };
}
function getMelbourneOffsetMilliseconds(instant) {
  const parts = getMelbourneDateTimeParts(instant);
  const wholeSecondInstant = Math.floor(instant.getTime() / 1000) * 1000;
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - wholeSecondInstant;
}
function melbourneDateTimeToIso(dateString, boundary) {
  const [year, month, day] = dateString.split('-').map(Number);
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
console.log(melbourneDateTimeToIso('2026-09-07', 'start'));
