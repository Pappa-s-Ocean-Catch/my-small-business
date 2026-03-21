
import type { Order, OrderItem, OrderItemAddon } from '@my-small-business/types';

// Extend the type for receipt line objects to allow 'center' alignment
type ReceiptLine = string | { text: string; bold?: boolean; large?: boolean; center?: boolean };

export type EpsonPrinterConfig = {
  printerUrl: string; // base URL like http://192.168.0.50 (or full service.cgi URL)
  printerDeviceId: string; // typically "local_printer"
  printerTimeoutMs: number; // Epson expects milliseconds in query param
  printerCopies: number;
};

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function normalizeBaseUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return '';
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

export function getEpsonServiceUrl(config: EpsonPrinterConfig): string {
  const base = normalizeBaseUrl(config.printerUrl);
  if (!base) return '';

  const devid = encodeURIComponent(config.printerDeviceId || 'local_printer');
  const timeout = Number.isFinite(config.printerTimeoutMs) ? Math.trunc(config.printerTimeoutMs) : 60000;

  // Allow user to paste a full service.cgi URL.
  if (base.includes('/cgi-bin/epos/service.cgi')) {
    return base.includes('?')
      ? base
      : `${base}?devid=${devid}&timeout=${timeout}`;
  }

  return `${base}/cgi-bin/epos/service.cgi?devid=${devid}&timeout=${timeout}`;
}

async function fetchWithTimeout(input: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

function formatMoney(amount: number): string {
  if (!Number.isFinite(amount)) return '0.00';
  return amount.toFixed(2);
}

function formatOrderHeaderLines(order: Order): string[] {
  const created = new Date(order.created_at);

  const lines: string[] = [];
  lines.push(`ORDER #${order.order_number}`);
  lines.push(created.toLocaleString());
  lines.push(`${order.order_type === 'delivery' ? 'DELIVERY' : 'PICKUP'}  •  ${order.payment_method.toUpperCase()}`);
  lines.push('');

  const customer = order.customer_name || order.customer_email;
  if (customer) lines.push(`Customer: ${customer}`);
  if (order.customer_phone) lines.push(`Phone: ${order.customer_phone}`);

  if (order.order_type === 'delivery' && order.delivery_address_line1) {
    lines.push('');
    lines.push('Delivery Address:');
    lines.push(order.delivery_address_line1);
    if (order.delivery_address_line2) lines.push(order.delivery_address_line2);
    const cityLine = [order.delivery_city, order.delivery_state, order.delivery_postcode].filter(Boolean).join(' ');
    if (cityLine) lines.push(cityLine);
  }

  if (order.special_instructions) {
    lines.push('');
    lines.push(`Notes: ${order.special_instructions}`);
  }

  lines.push('');
  lines.push('------------------------------');
  return lines;
}

function formatAddonLines(addons?: OrderItemAddon[]): ReceiptLine[] {
  if (!addons?.length) return [];
  // Group by name and price
  const grouped: Record<string, { name: string; qty: number; price: number }[]> = {};
  for (const a of addons) {
    const key = `${a.addon_item_name}__${a.addon_item_price ?? 0}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push({ name: a.addon_item_name, qty: 1, price: a.addon_item_price ?? 0 });
  }
  const lines: ReceiptLine[] = [];
  for (const key in grouped) {
    const group = grouped[key];
    const { name, price } = group[0];
    const qty = group.length;
    let line = qty > 1 ? `${qty}x ${name}` : name;
    if (price > 0) line += ` ($${formatMoney(price)})`;
    lines.push({
      text: `  + ${line}`,
      large: false,
      bold: price > 0
    });
  }
  return lines;
}

function formatItemLines(item: OrderItem): ReceiptLine[] {
  const lines: ReceiptLine[] = [];
  // Product item: bold and large
  lines.push({
    text: `${item.quantity}x ${item.product_name}`,
    bold: true,
    large: true,
  });
  lines.push(...formatAddonLines(item.addons));
  if (item.comment) lines.push(`  Note: ${item.comment}`);
  return lines;
}

export function buildKitchenReceiptLines(order: Order): ReceiptLine[] {
  const lines: ReceiptLine[] = [];
  lines.push(...formatOrderHeaderLines(order));

  if (order.items?.length) {
    for (const item of order.items) {
      lines.push(...formatItemLines(item));
      lines.push('');
    }
  } else {
    lines.push('(No items)');
    lines.push('');
  }

  lines.push('------------------------------');
  lines.push(`Subtotal: $${formatMoney(order.subtotal)}`);
  if (order.tax > 0) lines.push(`Tax:      $${formatMoney(order.tax)}`);
  if (order.delivery_fee > 0) lines.push(`Delivery: $${formatMoney(order.delivery_fee)}`);
  if (order.service_fee > 0) lines.push(`Service:  $${formatMoney(order.service_fee)}`);

  // Payment status to the right of TOTAL line
  let paymentStatus = 'UNPAID';
  if (order.payment_status && typeof order.payment_status === 'string') {
    paymentStatus = order.payment_status.toUpperCase() === 'PAID' ? 'PAID' : 'UNPAID';
  }
  // Add TOTAL line with payment status right-aligned
  const totalLine = `TOTAL:    $${formatMoney(order.total)}`;
  // Pad spaces to align payment status to the right (approximate for 32-char width)
  const padLen = Math.max(0, 32 - (totalLine.length + paymentStatus.length + 2));
  const pad = ' '.repeat(padLen);
  lines.push({
    text: `${totalLine}${pad}  ${paymentStatus}`,
    bold: true,
  });

  lines.push('');
  lines.push('');

  // Center-align payment status and order number at bottom
  lines.push({
    text: paymentStatus,
    bold: true,
    large: true,
    center: true,
  });

  // Print only the last segment of the order number as P###, bold and big, centered
  let orderNum = order.order_number || '';
  let lastSegment = orderNum.split('-').pop() || orderNum;
  // Remove any non-digit prefix (just in case)
  lastSegment = lastSegment.replace(/\D+/g, '');
  lines.push({
    text: `P${lastSegment}`,
    bold: true,
    large: true,
    center: true,
  });

  return lines;
}

function buildEposPrintXmlFromLines(lines: ReceiptLine[]): string {
  // Convert lines to XML <text> blocks with formatting
  const xmlLines = lines.map((line) => {
    if (typeof line === 'string') {
      return `<text lang="en">${escapeXml(line)}</text>`;
    }
    let attrs = '';
    if (line.bold) attrs += ' style="bold"';
    if (line.large) attrs += ' width="1.5" height="1.5';
    // Center alignment for lines with center: true
    if ((line as any).center) attrs += ' align="center"';
    return `<text lang="en"${attrs}>${escapeXml(line.text)}</text>`;
  });
  return `<?xml version="1.0" encoding="utf-8"?>\n<epos-print xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print">\n  ${xmlLines.join('\n  ')}\n  <feed />\n  <cut type="feed" />\n</epos-print>`;
}

function assertPrinterConfigured(config: EpsonPrinterConfig) {
  if (!config.printerUrl?.trim()) {
    throw new Error('Printer URL is not set');
  }
}

function parseEposResponseIsSuccess(bodyText: string): boolean {
  // ePOS returns XML like: <response success="true" code="..."/>
  return /success\s*=\s*"true"/i.test(bodyText);
}

export async function epsonTestPrint(config: EpsonPrinterConfig): Promise<void> {
  assertPrinterConfigured(config);

  const url = getEpsonServiceUrl(config);
  const xml = buildEposPrintXmlFromLines(['TEST PRINT', new Date().toLocaleString(), '', 'OK', '', '']);

  const response = await fetchWithTimeout(
    url,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
      },
      body: xml,
    },
    Math.max(1000, config.printerTimeoutMs || 60000)
  );

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Printer request failed (${response.status})`);
  }
  if (!parseEposResponseIsSuccess(text)) {
    throw new Error('Printer did not acknowledge success');
  }
}

export async function epsonPrintKitchenReceipt(order: Order, config: EpsonPrinterConfig): Promise<void> {
  assertPrinterConfigured(config);

  const url = getEpsonServiceUrl(config);
  const lines = buildKitchenReceiptLines(order);
  const xml = buildEposPrintXmlFromLines(lines);

  const copies = Number.isFinite(config.printerCopies) ? Math.max(1, Math.trunc(config.printerCopies)) : 1;

  for (let i = 0; i < copies; i++) {
    const response = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
        },
        body: xml,
      },
      Math.max(1000, config.printerTimeoutMs || 60000)
    );

    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Printer request failed (${response.status})`);
    }
    if (!parseEposResponseIsSuccess(text)) {
      throw new Error('Printer did not acknowledge success');
    }

    // Small spacing to avoid overwhelming the printer/network.
    if (i < copies - 1) {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
}
