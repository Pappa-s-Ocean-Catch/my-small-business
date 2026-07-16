import { Platform } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import type { SavedPrinter } from './escpos-printer';
import { getPrinterDriver } from './escpos-printer';

export type PrinterImageSource =
  | { kind: 'uri'; uri: string }
  | { kind: 'png-base64'; base64: string; previewUri?: string | null }
  | { kind: 'raw-argb'; width: number; height: number; argb: Uint8Array; previewUri?: string | null };

function decodeBase64(base64: string): Uint8Array {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const clean = base64.replace(/[^A-Za-z0-9+/=]/g, '');
  const padding = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  const outputLength = Math.floor((clean.length * 3) / 4) - padding;
  const output = new Uint8Array(outputLength);

  let outputIndex = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const c1 = chars.indexOf(clean[i] || 'A');
    const c2 = chars.indexOf(clean[i + 1] || 'A');
    const c3 = clean[i + 2] === '=' ? 0 : chars.indexOf(clean[i + 2] || 'A');
    const c4 = clean[i + 3] === '=' ? 0 : chars.indexOf(clean[i + 3] || 'A');
    const chunk = (c1 << 18) | (c2 << 12) | (c3 << 6) | c4;

    if (outputIndex < outputLength) output[outputIndex++] = (chunk >> 16) & 0xff;
    if (outputIndex < outputLength && clean[i + 2] !== '=') output[outputIndex++] = (chunk >> 8) & 0xff;
    if (outputIndex < outputLength && clean[i + 3] !== '=') output[outputIndex++] = chunk & 0xff;
  }

  return output;
}

function parseRawCapture(data: string): PrinterImageSource {
  const match = /^(\d+):(\d+)\|/.exec(data);
  if (!match) {
    throw new Error('Raw capture result is missing width/height metadata.');
  }

  const width = Number.parseInt(match[1], 10);
  const height = Number.parseInt(match[2], 10);
  const base64 = data.slice(match[0].length);
  const argb = decodeBase64(base64);
  return { kind: 'raw-argb', width, height, argb };
}

export async function captureReceiptForPrinter(
  ref: any,
  printer: SavedPrinter,
  width: number
): Promise<PrinterImageSource> {
  if (getPrinterDriver(printer) === 'rawTcp') {
    const [previewUri, base64] = await Promise.all([
      captureReceiptPreview(ref, width),
      captureRef(ref, {
        format: 'png',
        quality: 1,
        result: 'base64',
        width,
      }),
    ]);

    return { kind: 'png-base64', base64, previewUri };
  }

  const uri = await captureRef(ref, {
    format: 'png',
    quality: 1,
    result: 'tmpfile',
    width,
  });
  return { kind: 'uri', uri };
}

export async function captureReceiptPreview(
  ref: any,
  width: number
): Promise<string> {
  return await captureRef(ref, {
    format: 'png',
    quality: 1,
    result: 'tmpfile',
    width,
  });
}

export async function captureReceiptPreviewAndRaw(
  ref: any,
  width: number
): Promise<PrinterImageSource> {
  const [previewUri, base64] = await Promise.all([
    captureReceiptPreview(ref, width),
    captureRef(ref, {
      format: 'png',
      quality: 1,
      result: 'base64',
      width,
    }),
  ]);

  return { kind: 'png-base64', base64, previewUri };
}
