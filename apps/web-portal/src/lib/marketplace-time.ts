export function parseDoorDashTimestamp(value?: string | null) {
  if (!value) return null;
  const hasExplicitTimeZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value);
  const parsed = new Date(hasExplicitTimeZone ? value : `${value}Z`).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}
