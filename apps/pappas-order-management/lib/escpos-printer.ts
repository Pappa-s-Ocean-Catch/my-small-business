import type { Order } from '@my-small-business/types';
import { Printer, PrinterModelLang, PrinterConstants } from 'react-native-esc-pos-printer';
import { buildKitchenReceiptLines } from './epson-epos';

export type SavedPrinter = {
  target: string;
  deviceName: string;
  ipAddress?: string;
  macAddress?: string;
  bdAddress?: string;
  deviceType?: string;
};

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
  fn: (p: Printer) => Promise<T>,
  { timeoutMs }: { timeoutMs: number }
): Promise<T> {
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

export async function escposTestPrint(printer: SavedPrinter, copies: number): Promise<void> {
  assertPrinter(printer);
  const repeat = normalizeCopies(copies);

  for (let i = 0; i < repeat; i++) {
    await withConnectedPrinter(
      printer,
      async (p) => {
        await p.addText(`TEST PRINT\n${new Date().toLocaleString()}\n\nOK\n\n`);
        await p.addCut();
        await p.sendData();
      },
      { timeoutMs: 10000 }
    );
  }
}

export async function escposPrintKitchenReceipt(order: Order, printer: SavedPrinter, copies: number): Promise<void> {
  assertPrinter(printer);
  const repeat = normalizeCopies(copies);
  const lines = buildKitchenReceiptLines(order);

  for (let i = 0; i < repeat; i++) {
    await withConnectedPrinter(
      printer,
      async (p) => {
        p.addTextSize({ width: 1.35, height: 1.35 });
        for (const line of lines) {
          await printReceiptLine(p, line);
        }
        await p.addCut();
        await p.sendData();
      },
      { timeoutMs: 15000 }
    );
  }
}

// Helper to print a single line with formatting
async function printReceiptLine(p: Printer, line: string | { text: string; bold?: boolean; large?: boolean }) {
  if (typeof line === 'string') {
    await p.addText(line + '\n');
    return;
  }
  // Set formatting if supported by printer
  if (line.bold) await p.addTextStyle({ em: PrinterConstants.TRUE });
  if (line.large) await p.addTextSize({ width: 1.75, height: 1.75 });
  await p.addText(line.text + '\n');
  // Reset formatting after line
  if (line.bold) await p.addTextStyle({ em: PrinterConstants.FALSE });
  if (line.large) await p.addTextSize({ width: 1.25, height: 1.25 });
}
