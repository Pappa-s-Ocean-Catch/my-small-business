export type PrinterDriver = 'epsonSdk' | 'rawTcp' | 'simulator' | 'sunmi';

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

export const TCP_TARGET_PREFIX = 'TCP:';
export const SIMULATOR_TARGET_PREFIX = 'SIMULATOR:';
export const DEFAULT_MANUAL_PRINTER_PORT = 9100;
export const DEFAULT_SIMULATOR_PRINTER_NAME = 'Print Simulator';

export function isSimulatorPrinterTarget(target: string | null | undefined): boolean {
  return typeof target === 'string' && target.startsWith(SIMULATOR_TARGET_PREFIX);
}

export function getPrinterDriver(printer: SavedPrinter | null | undefined): PrinterDriver {
  if (printer?.driver === 'sunmi') return 'sunmi';
  if (printer?.driver === 'rawTcp') return 'rawTcp';
  if (printer?.driver === 'simulator' || isSimulatorPrinterTarget(printer?.target)) return 'simulator';
  return 'epsonSdk';
}

export function isSimulatorPrinter(printer: SavedPrinter | null | undefined): boolean {
  return getPrinterDriver(printer) === 'simulator';
}

export function createSunmiSavedPrinter(deviceName = 'Sunmi built-in'): SavedPrinter {
  return { target: 'SUNMI:BUILTIN', deviceName: deviceName.trim() || 'Sunmi built-in', driver: 'sunmi', deviceType: 'TYPE_PRINTER' };
}
