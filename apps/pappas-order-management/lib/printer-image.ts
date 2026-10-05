import { captureRef } from 'react-native-view-shot';
import type { SavedPrinter } from './escpos-printer';
import { registerReceiptCapture } from './receipt-capture-lifecycle';

export type PrinterImageSource =
  | { kind: 'uri'; uri: string; captureScale?: number; quality?: 'standard' | 'high' }
  | { kind: 'native-view'; nativeViewTag: number; captureScale: number; quality: 'standard' | 'high'; previewUri?: string | null };

export async function captureReceiptForPrinter(
  ref: any,
  printer: SavedPrinter,
  width: number,
  highQuality: boolean = true,
): Promise<PrinterImageSource> {
  // Snapshot now: a queued print must not depend on a later render or view lifetime.
  const uri = await captureRef(ref, {
    format: 'png',
    quality: 1,
    result: 'tmpfile',
    width,
  });
  registerReceiptCapture(uri);
  return { kind: 'uri', uri, captureScale: highQuality ? 2 : 1, quality: highQuality ? 'high' : 'standard' };
}

export async function captureReceiptPreview(ref: any, width: number): Promise<string> {
  const uri = await captureRef(ref, {
    format: 'png',
    quality: 1,
    result: 'tmpfile',
    width,
  });
  registerReceiptCapture(uri);
  return uri;
}
