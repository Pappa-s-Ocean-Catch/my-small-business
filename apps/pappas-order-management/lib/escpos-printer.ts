import type { Order } from '@my-small-business/types';
import { Printer, PrinterModelLang, PrinterConstants } from 'react-native-esc-pos-printer';
import { buildKitchenReceiptLines, type ReceiptLine } from './epson-epos';

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
        // Set default text size to 1x1 at start
        await p.addTextSize({ width: 1, height: 1 });
        
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

export async function escposPrintOrderImage(
  imageUri: string, 
  printer: SavedPrinter, 
  copies: number,
  width: number = 576
): Promise<void> {
  assertPrinter(printer);
  const repeat = normalizeCopies(copies);

  for (let i = 0; i < repeat; i++) {
    await withConnectedPrinter(
      printer,
      async (p) => {
        // Use the specified target width (e.g. 576 for 80mm, 384 for 58mm)
        await p.addImage({
          source: { uri: imageUri },
          width: width,
        });
        await p.addCut();
        await p.sendData();
      },
      { timeoutMs: 30000 } // Image printing can be slower
    );
  }
}

const ESC_M_FONT_A = new Uint8Array([0x1b, 0x4d, 0]);
const ESC_M_FONT_B = new Uint8Array([0x1b, 0x4d, 1]);

// Helper to print a single line with formatting
async function printReceiptLine(p: Printer, line: ReceiptLine) {
  // Reset formatting for each line
  await p.addCommand(ESC_M_FONT_A);
  await p.addTextStyle({ em: PrinterConstants.FALSE });
  await p.addTextSize({ width: 1, height: 1 });

  if (typeof line === 'string') {
    await p.addText(line + '\n');
    return;
  }

  // Large font = Font A, 2x2 (standard big)
  if (line.large) {
     await p.addTextSize({ width: 2, height: 2 });
  } 
  // Medium font = Font B, 2x2 (~1.5x of Font A normal)
  else if (line.medium) {
     await p.addCommand(ESC_M_FONT_B);
     await p.addTextSize({ width: 2, height: 2 });
  }

  if (line.bold) await p.addTextStyle({ em: PrinterConstants.TRUE });
  
  await p.addText(line.text + '\n');
}
