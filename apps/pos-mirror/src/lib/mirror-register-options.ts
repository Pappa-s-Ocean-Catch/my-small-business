export type MirrorRegisterRow = { register_id: unknown, register_name?: unknown };

export function normalizeMirrorRegisterIds(rows: readonly MirrorRegisterRow[]): { id: string; name: string }[] {
  return [...new Map(rows
    .flatMap(({ register_id, register_name }) => 
      typeof register_id === 'string' ? [{ id: register_id.trim(), name: typeof register_name === 'string' && register_name.trim() ? register_name.trim() : 'Unknown Register' }] : []
    )
    .filter(Boolean)
    .map(item => [item.id, item])).values()]
    .sort((left, right) => left.id.localeCompare(right.id));
}
