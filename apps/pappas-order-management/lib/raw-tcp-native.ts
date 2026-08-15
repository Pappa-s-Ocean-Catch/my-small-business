export type NativeRawTcpPrintOptions = {
  viewTag: number;
  host: string;
  port: number;
  width: number;
  copies: number;
  captureScale: number;
  timeoutMs: number;
};

export type NativeRawTcpPrintSuccess = {
  ok: true;
  captureMs: number;
  resizeMs: number;
  rasterMs: number;
  sendMs: number;
  totalMs: number;
  width: number;
  height: number;
  byteLength: number;
  fnv1a32: string;
  sent: boolean;
};

export type NativeRawTcpPrintFailure = {
  ok: false;
  totalMs: number;
  error: { code: NativeRawTcpPrintErrorCode; phase: string; message: string };
};

export type NativeRawTcpPrintResult = NativeRawTcpPrintSuccess | NativeRawTcpPrintFailure;

export type NativeRawTcpPrintErrorCode =
  | 'INVALID_OPTIONS'
  | 'VIEW_NOT_FOUND'
  | 'CAPTURE_FAILED'
  | 'RASTER_FAILED'
  | 'CONNECTION_FAILED'
  | 'SEND_FAILED'
  | 'TIMEOUT';

export type NativeRawTcpPrinter = {
  print(options: NativeRawTcpPrintOptions): Promise<NativeRawTcpPrintResult>;
};

export function getNativeRawTcpPrinter(
  loadModule: () => NativeRawTcpPrinter | null = () => {
    const module = require('@my-small-business/native-raw-tcp-printer') as typeof import('@my-small-business/native-raw-tcp-printer');
    return module.getNativeRawTcpPrinter();
  }
): NativeRawTcpPrinter | null {
  try {
    return loadModule();
  } catch {
    return null;
  }
}

export function getNativeRawTcpErrorCode(error: unknown): NativeRawTcpPrintErrorCode | null {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' && [
    'INVALID_OPTIONS', 'VIEW_NOT_FOUND', 'CAPTURE_FAILED', 'RASTER_FAILED',
    'CONNECTION_FAILED', 'SEND_FAILED', 'TIMEOUT',
  ].includes(code) ? code as NativeRawTcpPrintErrorCode : null;
}
