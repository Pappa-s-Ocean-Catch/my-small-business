export type MirrorRegisterRow = { register_id: unknown };

export function normalizeMirrorRegisterIds(rows: readonly MirrorRegisterRow[]): string[] {
  return [...new Set(rows
    .flatMap(({ register_id }) => typeof register_id === 'string' ? [register_id.trim()] : [])
    .filter(Boolean))]
    .sort((left, right) => left.localeCompare(right));
}
