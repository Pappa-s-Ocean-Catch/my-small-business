export function createRegisterId(randomUuid: () => string): string {
  return randomUuid();
}

export function normalizeRegisterName(
  value: string | null | undefined,
  fallback = 'Desktop Register',
): string {
  return value?.trim() || fallback;
}
