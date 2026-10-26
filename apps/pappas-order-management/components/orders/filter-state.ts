/** Count selected filter dimensions, independently of whether the panel is visible. */
export function countActiveOrderFilters(filters: Record<string, string | undefined>): number {
  return Object.values(filters).filter((value) => value !== undefined && value !== '' && value !== 'all').length;
}
