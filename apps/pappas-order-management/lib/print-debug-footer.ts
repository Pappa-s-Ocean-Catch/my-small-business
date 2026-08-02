export type KitchenPrintTrigger = 'auto' | 'manual' | 'reprint';

export type KitchenPrintDebugContext = Readonly<{
  enabled: boolean;
  registerName: string;
  deviceId: string;
  sessionId: string;
  trigger: KitchenPrintTrigger;
  routeLabel: string;
  sectionName: string;
  printerName: string;
  printerTarget: string;
  printMode: 'combine' | 'separate';
  copies: number;
  autoPrintEnabled: boolean;
  autoPrintDelaySeconds: number;
  paperWidth: '58mm' | '80mm';
  highQuality: boolean;
  capturedAt: string;
}>;

type KitchenPrintDebugContextInput = Omit<KitchenPrintDebugContext, 'registerName' | 'deviceId' | 'sectionName' | 'printerName' | 'printerTarget'> & {
  registerName?: string | null;
  deviceId?: string | null;
  sectionName?: string | null;
  printerName?: string | null;
  printerTarget?: string | null;
};

function displayValue(value: string | null | undefined, fallback: string): string {
  return value?.trim() || fallback;
}

function getShortDeviceId(deviceId: string): string {
  return deviceId.length <= 8 ? deviceId : deviceId.slice(-8);
}

export function createPrintDebugSessionId(
  now: number = Date.now(),
  random: number = Math.random(),
): string {
  return `${now.toString(36)}-${random.toString(36).slice(2, 8).padEnd(6, '0')}`;
}

export function buildKitchenPrintDebugContext(input: KitchenPrintDebugContextInput): KitchenPrintDebugContext {
  return Object.freeze({
    ...input,
    registerName: displayValue(input.registerName, 'Unnamed'),
    deviceId: displayValue(input.deviceId, 'unknown'),
    sectionName: displayValue(input.sectionName, 'All'),
    printerName: displayValue(input.printerName, 'No printer'),
    printerTarget: displayValue(input.printerTarget, 'none'),
    copies: Math.max(1, Math.trunc(input.copies)),
  });
}

export function getKitchenPrintDebugFooterLines(
  context: KitchenPrintDebugContext | null | undefined,
): string[] {
  if (!context?.enabled) return [];

  return [
    `PRINT DEBUG • ${context.trigger.toUpperCase()} • ${context.capturedAt}`,
    `POS ${context.registerName} • device ${getShortDeviceId(context.deviceId)} • session ${context.sessionId}`,
    `Route ${context.routeLabel} • section ${context.sectionName}`,
    `Printer ${context.printerName} • ${context.printerTarget}`,
    `Mode ${context.printMode} • copies ${context.copies}`,
    `Auto ${context.autoPrintEnabled ? 'on' : 'off'} • delay ${context.autoPrintDelaySeconds}s • ${context.paperWidth} • high quality ${context.highQuality ? 'on' : 'off'}`,
  ];
}
