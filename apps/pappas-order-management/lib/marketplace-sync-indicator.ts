export function getMarketplaceSyncIndicatorColor(
  enabled: boolean,
  hasProviderError: boolean,
): string {
  if (!enabled) return '#6b7fa8';
  return hasProviderError ? '#ff0000' : '#ffffff';
}
