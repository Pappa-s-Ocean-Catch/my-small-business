export type PrinterReceiptMode = 'text' | 'image';

export function normalizePrinterReceiptMode(value: unknown): PrinterReceiptMode {
  return value === 'image' ? 'image' : 'text';
}
