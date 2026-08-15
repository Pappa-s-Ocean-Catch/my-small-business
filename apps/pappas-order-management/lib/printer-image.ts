import { findNodeHandle } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import type { SavedPrinter } from './escpos-printer';
import { getPrinterDriver } from './escpos-printer';

export type PrinterImageSource =
  | { kind: 'uri'; uri: string; captureScale?: number; quality?: 'standard' | 'high' }
  | { kind: 'native-view'; nativeViewTag: number; captureScale: number; quality: 'standard' | 'high'; previewUri?: string | null };

export async function captureReceiptForPrinter(
  ref: any,
  printer: SavedPrinter,
  width: number,
  highQuality: boolean = true,
): Promise<PrinterImageSource> {
  if (getPrinterDriver(printer) === 'rawTcp') {
    const nativeViewTag = findNodeHandle(ref);
    if (!nativeViewTag) throw new Error('Receipt view is unavailable for native Raw TCP printing.');
    return {
      kind: 'native-view',
      nativeViewTag,
      captureScale: highQuality ? 2 : 1,
      quality: highQuality ? 'high' : 'standard',
    };
  }

  const uri = await captureRef(ref, {
    format: 'png',
    quality: 1,
    result: 'tmpfile',
    width,
  });
  return { kind: 'uri', uri, captureScale: highQuality ? 2 : 1, quality: highQuality ? 'high' : 'standard' };
}

export async function captureReceiptPreview(ref: any, width: number): Promise<string> {
  return await captureRef(ref, {
    format: 'png',
    quality: 1,
    result: 'tmpfile',
    width,
  });
}
