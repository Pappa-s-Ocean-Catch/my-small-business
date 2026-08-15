import { Platform } from 'react-native';
import type { PrinterImageSource } from './printer-image';
import { getNativeRawTcpPrinter, type NativeRawTcpPrintOptions } from './raw-tcp-native';
import { buildDocumentPrintJob } from './escpos-document';
import type { EscPosDocument } from './instore-instant-ticket';

export type PrinterDriver = 'epsonSdk' | 'rawTcp' | 'simulator';

export type SavedPrinter = {
  target: string;
  deviceName: string;
  driver?: PrinterDriver;
  ipAddress?: string;
  port?: number;
  macAddress?: string;
  bdAddress?: string;
  deviceType?: string;
};

const TCP_TARGET_PREFIX = 'TCP:';
const SIMULATOR_TARGET_PREFIX = 'SIMULATOR:';
export const DEFAULT_MANUAL_PRINTER_PORT = 9100;
export const DEFAULT_SIMULATOR_PRINTER_NAME = 'Print Simulator';
const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

type EscPosModule = typeof import('react-native-esc-pos-printer');
type TcpSocketModule = typeof import('react-native-tcp-socket');
type EscPosPrinterInstance = InstanceType<EscPosModule['Printer']>;
type TcpSocketLike = {
  createConnection: (...args: any[]) => any;
};

let escPosModuleCache: EscPosModule | null = null;
let tcpSocketModuleCache: TcpSocketModule | null = null;

function getEscPosModule(): EscPosModule {
  if (escPosModuleCache) return escPosModuleCache;
  // Delay loading the native printer module until a print action actually runs.
  escPosModuleCache = require('react-native-esc-pos-printer') as EscPosModule;
  return escPosModuleCache;
}

function getTcpSocketModule(): TcpSocketModule {
  if (tcpSocketModuleCache) return tcpSocketModuleCache;
  // Delay loading the raw TCP native module until a raw printer action runs.
  tcpSocketModuleCache = require('react-native-tcp-socket') as TcpSocketModule;
  return tcpSocketModuleCache;
}

function getTcpSocketClient(): TcpSocketLike {
  const tcpSocketModule = getTcpSocketModule() as TcpSocketModule & {
    default?: TcpSocketLike;
    createConnection?: TcpSocketLike['createConnection'];
  };

  const client = tcpSocketModule.default && typeof tcpSocketModule.default.createConnection === 'function'
    ? tcpSocketModule.default
    : typeof tcpSocketModule.createConnection === 'function'
      ? tcpSocketModule
      : null;

  if (!client) {
    throw new Error('react-native-tcp-socket is unavailable in this build');
  }

  return client;
}

function normalizePrinterField(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? '';
}

export function isValidIpv4Address(value: string): boolean {
  const trimmed = value.trim();
  const parts = trimmed.split('.');
  if (parts.length !== 4) return false;

  return parts.every((part) => {
    if (!/^\d+$/.test(part)) return false;
    if (part.length > 1 && part.startsWith('0')) return false;
    const valueNum = Number.parseInt(part, 10);
    return valueNum >= 0 && valueNum <= 255;
  });
}

export function isValidPrinterPort(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= 65535;
}

export function buildTcpPrinterTarget(ipAddress: string, port: number = DEFAULT_MANUAL_PRINTER_PORT): string {
  const normalizedIp = ipAddress.trim();
  if (!isValidPrinterPort(port) || port === DEFAULT_MANUAL_PRINTER_PORT) {
    return `${TCP_TARGET_PREFIX}${normalizedIp}`;
  }
  return `${TCP_TARGET_PREFIX}${normalizedIp}:${port}`;
}

export function createManualSavedPrinter(ipAddress: string, deviceName?: string, port: number = DEFAULT_MANUAL_PRINTER_PORT): SavedPrinter {
  const normalizedIp = ipAddress.trim();
  const normalizedPort = isValidPrinterPort(port) ? port : DEFAULT_MANUAL_PRINTER_PORT;
  return {
    target: buildTcpPrinterTarget(normalizedIp, normalizedPort),
    deviceName: deviceName?.trim() || `Manual printer (${normalizedIp})`,
    driver: 'rawTcp',
    ipAddress: normalizedIp,
    port: normalizedPort,
    deviceType: 'TYPE_PRINTER',
  };
}

export function buildSimulatorPrinterTarget(name: string = DEFAULT_SIMULATOR_PRINTER_NAME): string {
  const normalizedName = name.trim() || DEFAULT_SIMULATOR_PRINTER_NAME;
  return `${SIMULATOR_TARGET_PREFIX}${normalizedName}`;
}

export function createSimulatorSavedPrinter(deviceName?: string): SavedPrinter {
  const normalizedName = deviceName?.trim() || DEFAULT_SIMULATOR_PRINTER_NAME;
  return {
    target: buildSimulatorPrinterTarget(normalizedName),
    deviceName: normalizedName,
    driver: 'simulator',
    deviceType: 'TYPE_VIRTUAL_PRINTER',
  };
}

export function isSimulatorPrinter(printer: SavedPrinter | null | undefined): boolean {
  return getPrinterDriver(printer) === 'simulator';
}

export function isSimulatorPrinterTarget(target: string | null | undefined): boolean {
  return typeof target === 'string' && target.startsWith(SIMULATOR_TARGET_PREFIX);
}

export function getPrinterDriver(printer: SavedPrinter | null | undefined): PrinterDriver {
  if (printer?.driver === 'rawTcp') return 'rawTcp';
  if (printer?.driver === 'simulator' || isSimulatorPrinterTarget(printer?.target)) return 'simulator';
  return 'epsonSdk';
}

export async function getPrinterTransportLabel(printer: SavedPrinter): Promise<string> {
  const driver = getPrinterDriver(printer);
  if (driver === 'simulator') return 'simulator';
  if (driver === 'epsonSdk') return 'Epson SDK';
  return Platform.OS === 'android' || Platform.OS === 'ios' ? 'Native Raw TCP' : 'Native Raw TCP unavailable';
}

export function isSamePhysicalPrinter(
  left: Pick<SavedPrinter, 'deviceName' | 'macAddress' | 'bdAddress'> | null | undefined,
  right: Pick<SavedPrinter, 'deviceName' | 'macAddress' | 'bdAddress'> | null | undefined
): boolean {
  if (!left || !right) return false;

  const leftMac = normalizePrinterField(left.macAddress);
  const rightMac = normalizePrinterField(right.macAddress);
  if (leftMac && rightMac) return leftMac === rightMac;

  const leftBd = normalizePrinterField(left.bdAddress);
  const rightBd = normalizePrinterField(right.bdAddress);
  if (leftBd && rightBd) return leftBd === rightBd;

  const leftName = normalizePrinterField(left.deviceName);
  const rightName = normalizePrinterField(right.deviceName);
  return !!leftName && leftName === rightName;
}

export function mergeSavedPrinter(
  existing: SavedPrinter | null | undefined,
  next: SavedPrinter
): SavedPrinter {
  return {
    ...(existing ?? {}),
    ...next,
    deviceName: next.deviceName || existing?.deviceName || '',
    target: next.target || existing?.target || '',
    driver: next.driver || existing?.driver || 'epsonSdk',
  };
}

const printerQueues = new Map<string, Promise<void>>();

function getPrinterQueueKey(printer: SavedPrinter): string {
  return printer.target;
}

function enqueuePrinterJob<T>(printer: SavedPrinter, job: () => Promise<T>): Promise<T> {
  const queueKey = getPrinterQueueKey(printer);
  const printerQueue = printerQueues.get(queueKey) || Promise.resolve();
  const queued = printerQueue.then(job, job);
  printerQueues.set(queueKey, queued.then(
    () => undefined,
    () => undefined
  ));
  return queued;
}

function normalizeCopies(copies: number): number {
  const n = Number.isFinite(copies) ? Math.trunc(copies) : 1;
  return Math.min(10, Math.max(1, n));
}

function assertPrinter(printer: SavedPrinter | null | undefined): asserts printer is SavedPrinter {
  if (!printer || !printer.target || !printer.deviceName) {
    throw new Error('No printer selected');
  }
}
export function formatPrinterError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

async function withConnectedPrinter<T>(
  printer: SavedPrinter,
  fn: (p: EscPosPrinterInstance) => Promise<T>,
  { timeoutMs }: { timeoutMs: number }
): Promise<T> {
  const { Printer, PrinterModelLang } = getEscPosModule();
  const instance = new Printer({
    target: printer.target,
    deviceName: printer.deviceName,
    lang: PrinterModelLang.MODEL_ANK,
  });

  await instance.init();
  await instance.connect(timeoutMs);

  try {
    return await fn(instance);
  } finally {
    try {
      await instance.disconnect();
    } catch {
      // ignore disconnect failures
    }
  }
}

function getRawTcpConnectionOptions(printer: SavedPrinter) {
  const host = printer.ipAddress?.trim();
  const port = printer.port ?? DEFAULT_MANUAL_PRINTER_PORT;

  if (!host) {
    throw new Error('Raw TCP printer requires an IP address');
  }
  if (!isValidPrinterPort(port)) {
    throw new Error('Raw TCP printer port is invalid');
  }

  return { host, port };
}

async function withRawTcpPrinter<T>(
  printer: SavedPrinter,
  fn: (socket: any) => Promise<T>,
  { timeoutMs }: { timeoutMs: number }
): Promise<T> {
  const options = getRawTcpConnectionOptions(printer);

  return await new Promise<T>((resolve, reject) => {
    let settled = false;
    let connected = false;
    let pendingResult: T | undefined;
    let waitingForClose = false;
    let closeTimer: ReturnType<typeof setTimeout> | null = null;
    const TcpSocket = getTcpSocketClient();
    const socket = TcpSocket.createConnection({
      host: options.host,
      port: options.port,
      connectTimeout: timeoutMs,
    }, async () => {
      connected = true;
      try {
        if (typeof socket.setTimeout === 'function') {
          socket.setTimeout(0);
        }
        const result = await fn(socket);
        if (!settled) {
          pendingResult = result;
          waitingForClose = true;
          socket.end();
          closeTimer = setTimeout(() => {
            if (settled) return;
            settled = true;
            socket.destroy();
            resolve(result);
          }, 750);
        }
      } catch (error) {
        if (!settled) {
          settled = true;
          if (closeTimer) clearTimeout(closeTimer);
          socket.destroy();
          reject(error);
        }
      }
    });

    const finishWithError = (error: unknown) => {
      if (settled) return;
      if (connected && waitingForClose) {
        settled = true;
        if (closeTimer) clearTimeout(closeTimer);
        socket.destroy();
        resolve(pendingResult as T);
        return;
      }
      settled = true;
      if (closeTimer) clearTimeout(closeTimer);
      socket.destroy();
      reject(error instanceof Error ? error : new Error(String(error)));
    };

    socket.on('close', () => {
      if (settled || !waitingForClose) return;
      settled = true;
      if (closeTimer) clearTimeout(closeTimer);
      resolve(pendingResult as T);
    });
    socket.on('error', finishWithError);
    socket.on('timeout', () => finishWithError(new Error('Printer connection timed out')));
  });
}

async function writeRawBytes(socket: any, bytes: Uint8Array): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    let done = false;
    const settleSuccess = () => {
      if (done) return;
      done = true;
      resolve();
    };
    const settleError = (error: Error) => {
      if (done) return;
      done = true;
      reject(error);
    };

    socket.write(bytes, (error?: Error | null) => {
      if (error) {
        settleError(error);
        return;
      }
      settleSuccess();
    });

    // Some React Native TCP implementations do not reliably invoke the write
    // callback even though the printer already received the bytes.
    setTimeout(settleSuccess, 150);
  });
}

export async function escposPrintDocument(document: EscPosDocument, printer: SavedPrinter): Promise<void> {
  assertPrinter(printer);
  if (isSimulatorPrinter(printer)) {
    throw new Error('Instant tickets require a physical printer.');
  }

  return enqueuePrinterJob(printer, async () => {
    if (getPrinterDriver(printer) === 'rawTcp') {
      await withRawTcpPrinter(printer, (socket) => writeRawBytes(socket, buildDocumentPrintJob(document)), { timeoutMs: 30000 });
      return;
    }

    await withConnectedPrinter(printer, async (device) => {
      for (const node of document.nodes) {
        if (node.type === 'text') await device.addText(node.text);
        if (node.type === 'feed') await device.addText('\n'.repeat(node.lines ?? 1));
        if (node.type === 'cut') await device.addCut();
      }
      await device.sendData();
    }, { timeoutMs: 30000 });
  });
}

function concatBytes(parts: Array<number[] | Uint8Array>): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

export type PrintDispatchMetrics = {
  driver: PrinterDriver;
  quality: 'standard' | 'high';
  captureScale: number;
  totalMs: number;
  native?: { captureMs: number; resizeMs: number; rasterMs: number; sendMs: number; width: number; height: number; byteLength: number };
};

export async function escposPrintOrderImage(
  imageSource: PrinterImageSource | string,
  printer: SavedPrinter, 
  copies: number,
  width: number = 576
): Promise<PrintDispatchMetrics> {
  assertPrinter(printer);
  const repeat = normalizeCopies(copies);

  return await enqueuePrinterJob(printer, async () => {
    const rawDriver = getPrinterDriver(printer) === 'rawTcp';
    const startedAt = Date.now();
    const source: PrinterImageSource = typeof imageSource === 'string' ? { kind: 'uri', uri: imageSource } : imageSource;
    const quality = source.kind === 'native-view' ? source.quality : source.quality ?? 'standard';
    const captureScale = source.kind === 'native-view' ? source.captureScale : source.captureScale ?? 1;
    if (rawDriver) {
      if (Platform.OS !== 'android' && Platform.OS !== 'ios') throw new Error('Native Raw TCP is unavailable on this platform.');
      if (source.kind !== 'native-view') throw new Error('Native Raw TCP requires a receipt view source.');
      const nativePrinter = getNativeRawTcpPrinter();
      if (!nativePrinter) throw new Error('Native Raw TCP is unavailable in this build.');
      const { host, port } = getRawTcpConnectionOptions(printer);
      const result = await nativePrinter.print({ viewTag: source.nativeViewTag, host, port, width, copies: repeat, captureScale: source.captureScale, timeoutMs: 30000 } as NativeRawTcpPrintOptions);
      if (!result.ok || !result.sent) throw new Error(result.ok ? 'Native Raw TCP did not send the receipt.' : result.error.message);
      return { driver: 'rawTcp', quality, captureScale, totalMs: result.totalMs, native: { captureMs: result.captureMs, resizeMs: result.resizeMs, rasterMs: result.rasterMs, sendMs: result.sendMs, width: result.width, height: result.height, byteLength: result.byteLength } };
    }
    const imageUri = typeof imageSource === 'string'
      ? imageSource
      : imageSource.kind === 'uri'
        ? imageSource.uri
        : (imageSource.previewUri ?? null);

    for (let i = 0; i < repeat; i++) {
      {
        if (!imageUri) {
          throw new Error('Epson SDK printing requires an image URI.');
        }
        await withConnectedPrinter(
          printer,
          async (p) => {
            // Use the specified target width (e.g. 576 for 80mm, 384 for 58mm)
            await p.addImage({
              source: { uri: imageUri },
              width: width,
            });
            // Some printers need a little feed after large images before the cut
            // command is honored reliably.
            await p.addText('\n\n\n');
            await p.addCut();
            await p.sendData();
            await new Promise((resolve) => setTimeout(resolve, 250));
          },
          { timeoutMs: 30000 } // Image printing can be slower
        );
      }
    }
    return { driver: 'epsonSdk', quality, captureScale, totalMs: Date.now() - startedAt };
  });
}
