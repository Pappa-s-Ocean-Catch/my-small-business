import type { Order } from '@my-small-business/types';
import { getFriendlyOrderNumber } from '../utils/orderNumber';

export type InstoreInstantTicketSettings = {
  instoreInstantTicketEnabled: boolean;
  instoreInstantTicketPrinterTarget: string | null;
};

export function normalizeInstoreInstantTicketSettings(value: unknown): InstoreInstantTicketSettings {
  const settings = value as Partial<InstoreInstantTicketSettings> | null;
  const printerTarget = typeof settings?.instoreInstantTicketPrinterTarget === 'string'
    ? settings.instoreInstantTicketPrinterTarget.trim() || null
    : null;

  return {
    instoreInstantTicketEnabled: settings?.instoreInstantTicketEnabled === true,
    instoreInstantTicketPrinterTarget: printerTarget,
  };
}

export function getInstoreInstantTicketPrintJob(
  order: Pick<Order, 'order_channel' | 'payment_method' | 'payment_status'>,
  settings: InstoreInstantTicketSettings,
  savedTargets: string[],
): { printerTarget: string; priority: 'instant-ticket' } | null {
  const printerTarget = settings.instoreInstantTicketPrinterTarget;
  if (!settings.instoreInstantTicketEnabled
    || !printerTarget
    || order.order_channel !== 'instore'
    || order.payment_method !== 'store'
    || order.payment_status !== 'paid'
    || !savedTargets.includes(printerTarget)) {
    return null;
  }

  return { printerTarget, priority: 'instant-ticket' };
}

export function getInstoreInstantTicketDebugDetails(
  order: Pick<Order, 'order_channel' | 'payment_method' | 'payment_status'>,
  settings: InstoreInstantTicketSettings,
  savedTargets: string[],
): string {
  const target = settings.instoreInstantTicketPrinterTarget;
  const saved = Boolean(target && savedTargets.includes(target));
  const eligible = Boolean(getInstoreInstantTicketPrintJob(order, settings, savedTargets));
  return `enabled=${settings.instoreInstantTicketEnabled} target=${target ?? 'none'} saved=${saved} channel=${order.order_channel} method=${order.payment_method} payment=${order.payment_status} eligible=${eligible}`;
}

export function buildInstoreInstantTicketDocument(
  order: Pick<Order, 'order_number' | 'items' | 'created_at' | 'total' | 'payment_status'>,
): EscPosDocument {
  const createdAt = new Date(order.created_at);
  const orderTime = Number.isNaN(createdAt.getTime())
    ? 'UNKNOWN'
    : `${createdAt.getUTCFullYear()}-${String(createdAt.getUTCMonth() + 1).padStart(2, '0')}-${String(createdAt.getUTCDate()).padStart(2, '0')} ${String(createdAt.getUTCHours()).padStart(2, '0')}:${String(createdAt.getUTCMinutes()).padStart(2, '0')}`;
  const itemCount = (order.items ?? []).reduce((count, item) => count + Math.max(1, item.quantity ?? 1), 0);
  const total = Number.isFinite(order.total) ? order.total.toFixed(2) : '0.00';

  return {
    nodes: [
      {
        type: 'text',
        text: `ORDER #${getFriendlyOrderNumber(order.order_number)}`,
        style: { align: 'center', bold: true, widthScale: 2, heightScale: 2 },
        newline: true,
      },
      { type: 'text', text: `ORDER TIME: ${orderTime}`, newline: true },
      { type: 'feed', lines: 2 },
      ...(order.items ?? []).map((item) => ({ type: 'text' as const, text: item.product_name, newline: true })),
      { type: 'feed', lines: 1 },
      { type: 'text', text: `ITEMS: ${itemCount}`, newline: true },
      { type: 'text', text: `TOTAL: $${total}`, newline: true },
      { type: 'text', text: `PAYMENT: ${order.payment_status.toUpperCase()}`, newline: true },
      { type: 'feed', lines: 3 },
      { type: 'cut', partial: false },
    ],
  };
}

export type EscPosTextStyle = {
  align?: 'left' | 'center' | 'right';
  bold?: boolean;
  underline?: boolean;
  invert?: boolean;
  font?: 'A' | 'B';
  widthScale?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  heightScale?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
};

export type EscPosDocumentNode =
  | { type: 'text'; text: string; style?: EscPosTextStyle; newline?: boolean }
  | { type: 'feed'; lines?: number }
  | { type: 'cut'; partial?: boolean };

/** Structural subset of @my-small-business/escpos-printer's document contract. */
export type EscPosDocument = { initialize?: boolean; paperWidth?: '58mm' | '80mm'; nodes: EscPosDocumentNode[] };
