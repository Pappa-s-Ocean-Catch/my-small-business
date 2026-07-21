import { createHash } from 'crypto';

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

function stableSerialize(value: JsonValue): string {
  if (value === null) return 'null';

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(',')}]`;
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value).sort(([a], [b]) => a.localeCompare(b));
    return `{${entries
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableSerialize(nested as JsonValue)}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
}

export function getShipdayPayloadHash(payload: JsonValue | undefined): string {
  return createHash('sha256')
    .update(stableSerialize(payload ?? null))
    .digest('hex');
}
