export function resolveOnlineOrderOverride(): boolean | null {
  const rawValue = process.env.NEXT_PUBLIC_ENABLE_ONLINE_ORDER;
  if (rawValue === undefined) {
    return null;
  }

  const normalized = rawValue.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }

  return null;
}
