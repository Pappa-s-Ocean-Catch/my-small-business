// Only images created by our receipt capture pipeline may be deleted here.
const captures = new Map<string, { owners: number; createdAt: number }>();
export function registerReceiptCapture(uri: string): void {
  captures.set(uri, { owners: 0, createdAt: Date.now() });
}
export function retainReceiptCapture(uri: string): void {
  const capture = captures.get(uri);
  if (capture) capture.owners++;
}
export function releaseReceiptCapture(uri: string): void {
  const capture = captures.get(uri);
  if (!capture) return;
  capture.owners = Math.max(0, capture.owners - 1);
  if (capture.owners === 0) {
    try {
      // Text printing never needs to load the native view-shot module.
      const { releaseCapture } = require('react-native-view-shot') as typeof import('react-native-view-shot');
      releaseCapture(uri);
      captures.delete(uri);
    } catch (error) {
      console.warn('Unable to release receipt capture', error);
    }
  }
}
export function pruneOrphanedReceiptCaptures(): void {
  for (const [uri, capture] of captures) {
    if (capture.owners === 0 && Date.now() - capture.createdAt > 10 * 60 * 1000) releaseReceiptCapture(uri);
  }
}
