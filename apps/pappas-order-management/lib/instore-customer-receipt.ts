import type { Order } from '@my-small-business/types';

export type InstoreCustomerReceiptSettings = {
  instoreCustomerReceiptAutoPrintEnabled: boolean;
  instoreCustomerReceiptPrinterTarget: string | null;
  instoreCustomerReceiptEnabledFromTime: string | null;
  instoreCustomerReceiptEnabledToTime: string | null;
};

function normalizeTimeWindowValue(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!/^\d{2}:\d{2}$/.test(normalized)) return null;
  const [hoursText, minutesText] = normalized.split(':');
  const hours = Number.parseInt(hoursText, 10);
  const minutes = Number.parseInt(minutesText, 10);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function parseTimeMinutes(value: string | null): number | null {
  if (!value) return null;
  const [hoursText, minutesText] = value.split(':');
  return (Number.parseInt(hoursText, 10) * 60) + Number.parseInt(minutesText, 10);
}

export function normalizeInstoreCustomerReceiptSettings(value: unknown): InstoreCustomerReceiptSettings {
  const settings = value as Partial<InstoreCustomerReceiptSettings> | null;
  const printerTarget = typeof settings?.instoreCustomerReceiptPrinterTarget === 'string'
    ? settings.instoreCustomerReceiptPrinterTarget.trim() || null
    : null;

  return {
    instoreCustomerReceiptAutoPrintEnabled: settings?.instoreCustomerReceiptAutoPrintEnabled === true,
    instoreCustomerReceiptPrinterTarget: printerTarget,
    instoreCustomerReceiptEnabledFromTime: normalizeTimeWindowValue(settings?.instoreCustomerReceiptEnabledFromTime),
    instoreCustomerReceiptEnabledToTime: normalizeTimeWindowValue(settings?.instoreCustomerReceiptEnabledToTime),
  };
}

export function isInstoreCustomerReceiptTimeWindowEnabled(
  fromTime: string | null,
  toTime: string | null,
  now = new Date(),
): boolean {
  const fromMinutes = parseTimeMinutes(fromTime);
  const toMinutes = parseTimeMinutes(toTime);
  if (fromMinutes == null || toMinutes == null || fromMinutes === toMinutes) return true;

  const nowMinutes = (now.getHours() * 60) + now.getMinutes();
  return fromMinutes < toMinutes
    ? nowMinutes >= fromMinutes && nowMinutes < toMinutes
    : nowMinutes >= fromMinutes || nowMinutes < toMinutes;
}

export function isInstoreCustomerReceiptAutoPrintEligible(
  order: Pick<Order, 'order_channel' | 'payment_status' | 'payment_method' | 'payment_method_detail'>,
  settings: InstoreCustomerReceiptSettings,
  now = new Date(),
): boolean {
  const paymentDetail = order.payment_method_detail?.trim().toLowerCase() || '';
  return settings.instoreCustomerReceiptAutoPrintEnabled
    && !!settings.instoreCustomerReceiptPrinterTarget
    && order.order_channel === 'instore'
    && order.payment_status === 'paid'
    && order.payment_method === 'store'
    && ['cash', 'card', 'smartpay'].includes(paymentDetail)
    && isInstoreCustomerReceiptTimeWindowEnabled(
      settings.instoreCustomerReceiptEnabledFromTime,
      settings.instoreCustomerReceiptEnabledToTime,
      now,
    );
}
