import { requireNativeModule } from 'expo-modules-core';

export type NativeRawTcpOperation = 'diagnostic' | 'print';
export type NativeRawTcpPrintErrorCode = 'INVALID_OPTIONS' | 'VIEW_NOT_FOUND' | 'CAPTURE_FAILED' | 'RASTER_FAILED' | 'CONNECTION_FAILED' | 'SEND_FAILED' | 'TIMEOUT';
export type NativeRawTcpPrintOptions = { viewTag: number; host: string; port: number; width: number; copies: number; operation: NativeRawTcpOperation; timeoutMs: number };
export type NativeRawTcpPrintSuccess = { ok: true; captureMs: number; resizeMs: number; rasterMs: number; sendMs: number; totalMs: number; width: number; height: number; byteLength: number; fnv1a32: string; sent: boolean };
export type NativeRawTcpPrintFailure = { ok: false; totalMs: number; error: { code: NativeRawTcpPrintErrorCode; phase: string; message: string } };
export type NativeRawTcpPrintResult = NativeRawTcpPrintSuccess | NativeRawTcpPrintFailure;
export type NativeRawTcpPrinter = { print(options: NativeRawTcpPrintOptions): Promise<NativeRawTcpPrintResult> };

export function getNativeRawTcpPrinter(): NativeRawTcpPrinter | null {
  try {
    return requireNativeModule<NativeRawTcpPrinter>('NativeRawTcpPrinter');
  } catch {
    return null;
  }
}
