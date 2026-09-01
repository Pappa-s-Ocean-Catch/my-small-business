import type { Order } from '@my-small-business/types';
import type { EscPosDocument, EscPosDocumentNode, EscPosTextStyle } from './instore-instant-ticket';
import {
  buildKitchenReceiptCopies,
  getOrderDisplaySubtotal,
  getOrderDisplayTotal,
  getOrderItemDisplaySubtotal,
  getOrderLineItemCount,
  getOrderNotes,
  getOrderOptions,
  getReceiptHeader,
  groupAddons,
} from '../utils/orderUtils';
import { getDeliveryStatusLabel } from '../utils/constants';
import { getOrderPromotionSummary, isFreePromotionOrderItem } from './promotion-summary';
import { getKitchenPrintDebugFooterLines, type KitchenPrintDebugContext } from './print-debug-footer';
import { getOrderPrintIntegrityWarning } from './order-print-integrity';

export type KitchenReceiptDocumentOptions = {
  paperWidth: '58mm' | '80mm';
  showTicketCounter?: boolean;
  onlyTicketIndex?: number;
  duplicateBySections?: boolean;
  printDebugContext?: KitchenPrintDebugContext | null;
};

const bold: EscPosTextStyle = { bold: true };
const centerBold: EscPosTextStyle = { align: 'center', bold: true };

function money(value: number | null | undefined): string {
  return Number(value ?? 0).toFixed(2);
}

function formatReceiptTimestamp(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(new Date(value)).map((part) => (
    part.type === 'dayPeriod' ? part.value.toUpperCase() : part.value
  )).join('').replace(/\s+(AM|PM)$/, ' $1');
}

function wrap(value: string, width: number): string[] {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    if (!line) {
      line = word;
    } else if (line.length + word.length + 1 <= width) {
      line += ` ${word}`;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function twoColumn(label: string, value: string, width: number, filler = ' '): string[] {
  if (label.length + value.length + 1 <= width) {
    return [`${label}${filler.repeat(width - label.length - value.length)}${value}`];
  }
  return [...wrap(label, width), value.padStart(width)];
}

function addText(nodes: EscPosDocumentNode[], text: string, style?: EscPosTextStyle) {
  nodes.push({ type: 'text', text, style, newline: true });
}

function addWrapped(nodes: EscPosDocumentNode[], text: string, width: number, style?: EscPosTextStyle) {
  for (const line of wrap(text, width)) addText(nodes, line, style);
}

export function buildKitchenReceiptDocument(order: Order, options: KitchenReceiptDocumentOptions): EscPosDocument {
  const width = options.paperWidth === '58mm' ? 32 : 48;
  const header = getReceiptHeader(order);
  const marketplaceName = header.logo === 'uber_eats'
    ? 'UBER EATS'
    : header.logo === 'doordash'
      ? 'DOORDASH'
      : header.label;
  const allTickets = buildKitchenReceiptCopies(order.items || []);
  const combinedSections = allTickets.length > 0
    ? allTickets.flatMap((ticket) => ticket.sections)
    : [{ sectionName: null, items: order.items || [] }];
  const tickets = options.duplicateBySections
    ? (options.onlyTicketIndex == null ? allTickets : allTickets[options.onlyTicketIndex] ? [allTickets[options.onlyTicketIndex]] : allTickets)
    : [{ key: 'combined', copyNumber: 1, totalCopies: 1, sections: combinedSections }];
  const nodes: EscPosDocumentNode[] = [];
  const createdDate = formatReceiptTimestamp(order.created_at);
  const pickupDisplay = order.scheduled_pickup_at
    ? new Date(order.scheduled_pickup_at).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null;
  const orderNotes = getOrderNotes(order);
  const promotion = getOrderPromotionSummary(order);
  const rewardPointsBalance = Number((order as Order & { reward_points_balance?: number | null }).reward_points_balance ?? 0);
  const externalOrderReference = order.external_order_number?.trim();

  tickets.forEach((ticket, ticketIndex) => {
    if (ticketIndex > 0) nodes.push({ type: 'feed', lines: 3 });
    // Epson's width scaling corrupts some headers; height-only is the same large,
    // reliable treatment used by the item lines.
    addText(nodes, marketplaceName, { ...centerBold, heightScale: 2 });
    if (options.showTicketCounter && tickets.length > 1) addText(nodes, `${ticket.copyNumber}/${ticket.totalCopies}`, { align: 'right', bold: true });
    if (pickupDisplay) {
      addText(nodes, '*** PRE-ORDER ***', { ...centerBold, widthScale: 2, heightScale: 2 });
      addText(nodes, `PICKUP: ${pickupDisplay}`, centerBold);
    }
    addText(nodes, createdDate, { align: 'center' });
    addText(nodes, order.payment_method?.toUpperCase() || '', { align: 'center' });
    if (externalOrderReference) addText(nodes, `ORDER ID: ${externalOrderReference}`, centerBold);

    const customerName = order.customer_name || order.customer_email || '';
    if (customerName || order.customer_phone) {
      addText(nodes, '-'.repeat(width));
      if (customerName) addWrapped(nodes, customerName, width, { align: 'center', bold: true });
      if (order.customer_phone) addWrapped(nodes, order.customer_phone, width, { align: 'center', bold: true });
      addText(nodes, '-'.repeat(width));
    }
    if (order.order_type === 'delivery' && order.delivery_address_line1) {
      addText(nodes, 'Delivery Address:', { invert: true });
      addWrapped(nodes, order.delivery_address_line1, width, { bold: true, invert: true });
      if (order.delivery_address_line2) addWrapped(nodes, order.delivery_address_line2, width, { bold: true, invert: true });
      addWrapped(nodes, [order.delivery_city, order.delivery_state, order.delivery_postcode].filter(Boolean).join(' '), width, { bold: true, invert: true });
      addWrapped(nodes, `Delivery Status: ${getDeliveryStatusLabel(order.delivery_status)}`, width, { invert: true });
      if (order.delivery_driver_name) addWrapped(nodes, `Driver: ${order.delivery_driver_name}`, width, { invert: true });
      if (order.delivery_driver_phone) addWrapped(nodes, `Driver Phone: ${order.delivery_driver_phone}`, width, { invert: true });
      if (order.delivery_driver_pin) addWrapped(nodes, `Driver PIN: ${order.delivery_driver_pin}`, width, { invert: true });
      if (order.delivery_vehicle_info) addWrapped(nodes, `Vehicle: ${order.delivery_vehicle_info}`, width, { invert: true });
      if (order.delivery_instructions) addWrapped(nodes, `Instructions: ${order.delivery_instructions}`, width, { invert: true });
    }
    if (orderNotes) {
      addText(nodes, 'ORDER NOTES:', bold);
      addWrapped(nodes, orderNotes, width);
    }
    for (const option of getOrderOptions(order)) addWrapped(nodes, `* ${option}`, width, bold);

    ticket.sections.forEach((section) => {
      if (section.sectionName) {
        nodes.push({ type: 'feed', lines: 1 });
        const sectionName = section.sectionName.toUpperCase();
        const leftDots = Math.floor((width - sectionName.length) / 2);
        addText(nodes, `${'.'.repeat(leftDots)}${sectionName}${'.'.repeat(width - leftDots - sectionName.length)}`, centerBold);
        nodes.push({ type: 'feed', lines: 1 });
      }
      section.items.forEach((item, index) => {
        const lineTotal = getOrderItemDisplaySubtotal(item);
        const itemLabel = `${item.quantity}x ${item.product_name.toUpperCase()}`;
        const itemPrice = isFreePromotionOrderItem(order, item.product_name) ? 'FREE' : `$${money(lineTotal)}`;
        const itemWidth = width;
        for (const line of wrap(`${itemLabel} - ${itemPrice}`, itemWidth)) addText(nodes, line, { ...bold, doubleStrike: true });
        if (isFreePromotionOrderItem(order, item.product_name)) addText(nodes, `$${money(lineTotal)} original`, { align: 'right' });
        for (const ingredient of item.removed_ingredients || []) addWrapped(nodes, `No ${ingredient}`, width, bold);
        for (const addon of groupAddons(item.addons || [])) {
          for (const line of wrap(`${addon.quantity > 1 ? `${addon.quantity}x ` : '+ '}${addon.name}${addon.price ? ` ($${money(addon.price)})` : ''}`, width - 2)) {
            addText(nodes, `  ${line}`, bold);
          }
        }
        if (item.comment?.trim()) addWrapped(nodes, `Notes: ${item.comment}`, width, { bold: true });
        if (index < section.items.length - 1) nodes.push({ type: 'feed', lines: 1 });
      });
    });

    addText(nodes, '_'.repeat(width));
    for (const line of twoColumn('Total items:', String(getOrderLineItemCount(order)), width)) addText(nodes, line, { heightScale: 2 });
    for (const line of twoColumn('Subtotal:', `$${money(getOrderDisplaySubtotal(order))}`, width)) addText(nodes, line, { heightScale: 2 });
    if (order.tax > 0) for (const line of twoColumn('Tax:', `$${money(order.tax)}`, width)) addText(nodes, line);
    if (order.delivery_fee > 0) for (const line of twoColumn('Delivery Fee:', `$${money(order.delivery_fee)}`, width)) addText(nodes, line);
    if (order.promotion_discount > 0) for (const line of twoColumn(`${promotion?.label || 'Promotion Discount'}:`, `-$${money(order.promotion_discount)}`, width)) addText(nodes, line);
    if (order.coupon_discount > 0) for (const line of twoColumn(order.coupon_code ? `Coupon (${order.coupon_code}):` : 'Coupon Discount:', `-$${money(order.coupon_discount)}`, width)) addText(nodes, line);
    if ((order.reward_points_used ?? 0) > 0 && (order.reward_points_value ?? 0) > 0) for (const line of twoColumn(`Points (${order.reward_points_used!.toLocaleString()}):`, `-$${money(order.reward_points_value)}`, width)) addText(nodes, line);
    if (rewardPointsBalance > 0) for (const line of twoColumn('Points Balance:', rewardPointsBalance.toLocaleString(), width)) addText(nodes, line);
    if (order.service_fee > 0) for (const line of twoColumn('Service Fee:', `$${money(order.service_fee)}`, width)) addText(nodes, line);
    for (const line of twoColumn('TOTAL:', `$${money(getOrderDisplayTotal(order))} ${order.payment_status?.toUpperCase() === 'PAID' ? 'PAID' : 'UNPAID'}`, width)) addText(nodes, line, { bold: true, heightScale: 2 });
    addText(nodes, `P${order.order_number?.split('-').pop()?.replace(/\D+/g, '') || ''}`, { ...centerBold, widthScale: 2, heightScale: 2 });
    addText(nodes, 'Thanks for your order!', { align: 'center' });
    for (const debugLine of getKitchenPrintDebugFooterLines(options.printDebugContext)) addWrapped(nodes, debugLine, width);
    const integrityWarning = getOrderPrintIntegrityWarning(order);
    if (integrityWarning) addWrapped(nodes, integrityWarning, width, { bold: true, invert: true });
    nodes.push({ type: 'feed', lines: 3 }, { type: 'cut', partial: false });
  });

  return { paperWidth: options.paperWidth, nodes };
}
