import { decodePngRgba } from './png';
import type { PrinterImageSource } from './printer-image';
import { prepareEscPosImage } from './escpos-raster';

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

function yieldToJsLoop(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

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

async function readImageBytes(imageUri: string): Promise<Uint8Array> {
  const response = await fetch(imageUri);
  if (!response.ok) {
    throw new Error(`Failed to load print image (${response.status})`);
  }
  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}

async function rgbaToEscPosBitImage(width: number, height: number, rgba: Uint8Array): Promise<Uint8Array> {
  const parts: Array<number[] | Uint8Array> = [Uint8Array.from([ESC, 0x33, 24])];
  let stripeCount = 0;

  for (let y = 0; y < height; y += 24) {
    const line = new Uint8Array(5 + (width * 3) + 1);
    line[0] = ESC;
    line[1] = 0x2a;
    line[2] = 33;
    line[3] = width & 0xff;
    line[4] = (width >> 8) & 0xff;

    let offset = 5;
    for (let x = 0; x < width; x += 1) {
      for (let stripe = 0; stripe < 3; stripe += 1) {
        let value = 0;
        for (let bit = 0; bit < 8; bit += 1) {
          const sourceY = y + (stripe * 8) + bit;
          if (sourceY >= height) continue;
          const pixelIndex = (sourceY * width + x) * 4;
          const r = rgba[pixelIndex];
          const g = rgba[pixelIndex + 1];
          const b = rgba[pixelIndex + 2];
          const a = rgba[pixelIndex + 3];
          const luminance = (r * 0.299) + (g * 0.587) + (b * 0.114);
          const isBlack = a > 0 && luminance < 180;
          if (isBlack) {
            value |= (1 << (7 - bit));
          }
        }
        line[offset] = value;
        offset += 1;
      }
    }

    line[offset] = LF;
    parts.push(line);
    stripeCount += 1;

    // Large raw-TCP images can take several hundred ms of CPU on the JS
    // thread, so we periodically yield to keep POS interactions responsive.
    if (stripeCount % 4 === 0) {
      await yieldToJsLoop();
    }
  }

  parts.push(Uint8Array.from([ESC, 0x32]));
  return concatBytes(parts);
}

function argbToRgba(argb: Uint8Array): Uint8Array {
  const rgba = new Uint8Array(argb.length);
  for (let source = 0; source < argb.length; source += 4) {
    rgba[source] = argb[source + 1] ?? 0;
    rgba[source + 1] = argb[source + 2] ?? 0;
    rgba[source + 2] = argb[source + 3] ?? 0;
    rgba[source + 3] = argb[source] ?? 255;
  }
  return rgba;
}

async function resizeRgbaToWidth(width: number, height: number, rgba: Uint8Array, maxWidth: number) {
  const alignWidth = (value: number) => {
    const safe = Math.max(8, value);
    return safe - (safe % 8);
  };

  const normalizedMaxWidth = alignWidth(maxWidth);
  if (width <= normalizedMaxWidth && width % 8 === 0) {
    return { width, height, rgba };
  }

  const scale = Math.min(1, normalizedMaxWidth / width);
  const nextWidth = alignWidth(Math.floor(width * scale));
  const nextHeight = Math.max(1, Math.floor(height * scale));
  const output = new Uint8Array(nextWidth * nextHeight * 4);
  const rowYieldInterval = scale === 1 ? 64 : 24;

  for (let y = 0; y < nextHeight; y += 1) {
    const sourceY = Math.min(height - 1, Math.floor(y / scale));
    for (let x = 0; x < nextWidth; x += 1) {
      const sourceX = Math.min(width - 1, Math.floor(x / scale));
      const sourceIndex = (sourceY * width + sourceX) * 4;
      const targetIndex = (y * nextWidth + x) * 4;
      output[targetIndex] = rgba[sourceIndex];
      output[targetIndex + 1] = rgba[sourceIndex + 1];
      output[targetIndex + 2] = rgba[sourceIndex + 2];
      output[targetIndex + 3] = rgba[sourceIndex + 3];
    }

    if ((y + 1) % rowYieldInterval === 0) {
      await yieldToJsLoop();
    }
  }

  return { width: nextWidth, height: nextHeight, rgba: output };
}

async function buildRawImagePrintBytes(imageSource: PrinterImageSource | string, maxWidth: number): Promise<Uint8Array> {
  const source = typeof imageSource === 'string' ? { kind: 'uri', uri: imageSource } as const : imageSource;
  const prepared = source.kind === 'raw-argb'
    ? await prepareEscPosImage(source, maxWidth)
    : await (async () => {
      const pngBytes = source.kind === 'png-base64' ? decodeBase64(source.base64) : await readImageBytes(source.uri);
      return await prepareEscPosImage(source.kind === 'png-base64' ? { kind: 'png-base64', base64: source.base64 } : { kind: 'png-bytes', bytes: pngBytes }, maxWidth);
    })();
  console.info(`[raw-tcp-baseline] source=${source.kind} size=${prepared.width}x${prepared.height} sourceBytes=${prepared.sourceByteLength} rasterBytes=${prepared.bytes.length} decode=${prepared.phasesMs.decode}ms resize=${prepared.phasesMs.resize}ms raster=${prepared.phasesMs.raster}ms total=${prepared.phasesMs.total}ms`);
  return prepared.bytes;
}

export async function escposPrintOrderImage(
  imageSource: PrinterImageSource | string, 
  printer: SavedPrinter, 
  copies: number,
  width: number = 576
): Promise<void> {
  assertPrinter(printer);
  const repeat = normalizeCopies(copies);

  return enqueuePrinterJob(printer, async () => {
    const rawImageBytes = getPrinterDriver(printer) === 'rawTcp'
      ? await buildRawImagePrintBytes(imageSource, width)
      : null;
    const imageUri = typeof imageSource === 'string'
      ? imageSource
      : imageSource.kind === 'uri'
        ? imageSource.uri
        : (imageSource.previewUri ?? null);

    for (let i = 0; i < repeat; i++) {
      if (getPrinterDriver(printer) === 'rawTcp') {
        await withRawTcpPrinter(printer, async (socket) => {
          await writeRawBytes(socket, rawImageBytes!);
        }, { timeoutMs: 30000 });
      } else {
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
  });
}
