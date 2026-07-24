import type { Order, OrderStatus, OrderItemAddon, OrderChannel } from '@my-small-business/types';
import { getFriendlyOrderNumber } from './orderNumber';
import { STATUS_LABELS, PAYMENT_STATUS_LABELS } from './constants';
import { getOrderPromotionSummary } from '../lib/promotion-summary';

export const KITCHEN_SECTION_OPTIONS = ['Fried', 'Grilled', 'Till'] as const;

export const groupAddons = (addons: OrderItemAddon[]) => {
  if (!addons || addons.length === 0) return [];
  
  const grouped: Record<string, { 
    name: string; 
    group: string; 
    price: number; 
    quantity: number 
  }> = {};
  
  addons.forEach(addon => {
    // Group by name + price + group name to be safe
    // We avoid using addon_item_id because it might be unique per order entry in some DB schemas
    const key = `${addon.addon_item_name}-${addon.addon_group_name}-${addon.addon_item_price}-${addon.section || ''}`;
    if (grouped[key]) {
      grouped[key].quantity += 1;
    } else {
      grouped[key] = {
        name: addon.addon_item_name,
        group: addon.addon_group_name,
        price: addon.addon_item_price,
        quantity: 1
      };
    }
  });
  
  return Object.values(grouped);
};

export const formatDateToLocalISO = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getTodayDateString = () => {
  return formatDateToLocalISO(new Date());
};

export const getApiUrl = (path: string) => {
  const base = (process.env.EXPO_PUBLIC_API_URL || '').replace(/\/+$/, '');
  const normalizedPath = `/${path.replace(/^\/+/, '')}`;

  if (!base) {
    return normalizedPath;
  }

  if (base.endsWith('/api') && normalizedPath.startsWith('/api/')) {
    return `${base}${normalizedPath.slice(4)}`;
  }

  return `${base}${normalizedPath}`;
};

export const formatElapsed = (
  createdAtIso: string, 
  nowMs: number, 
  scheduledPickupAtIso?: string | null
): { text: string; minutes: number; isCountdown: boolean; overdue: boolean } => {
  if (scheduledPickupAtIso) {
    const targetMs = new Date(scheduledPickupAtIso).getTime();
    const diffSec = Math.floor((targetMs - nowMs) / 1000);
    const overdue = diffSec < 0;
    const absSec = Math.abs(diffSec);

    // If more than 1 hour away (or 1 hour overdue), use D H M format
    if (absSec >= 3600) {
      const d = Math.floor(absSec / 86400);
      const h = Math.floor((absSec % 86400) / 3600);
      const m = Math.floor((absSec % 3600) / 60);
      
      let parts = [];
      if (d > 0) parts.push(`${d}D`);
      if (h > 0 || d > 0) parts.push(`${h}H`);
      parts.push(`${m}M`);
      
      const prefix = overdue ? '-' : '';
      return { 
        text: `${prefix}${parts.join(' ')}`, 
        minutes: Math.floor(absSec / 60), 
        isCountdown: true, 
        overdue 
      };
    }

    // Less than 1 hour: MM:SS format
    const minutes = Math.floor(absSec / 60);
    const seconds = absSec % 60;
    const mm = String(minutes).padStart(2, '0');
    const ss = String(seconds).padStart(2, '0');
    const prefix = overdue ? '-' : '';
    return { text: `${prefix}${mm}:${ss}`, minutes, isCountdown: true, overdue };
  }

  const createdMs = new Date(createdAtIso).getTime();
  const diffSec = Math.max(0, Math.floor((nowMs - createdMs) / 1000));
  const minutes = Math.floor(diffSec / 60);
  const seconds = diffSec % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  return { text: `${mm}:${ss}`, minutes, isCountdown: false, overdue: false };
};

export const getOrderChannel = (order: Pick<Order, 'order_channel' | 'payment_method' | 'customer_name'>): OrderChannel => {
  if (
    order.order_channel === 'online'
    || order.order_channel === 'phone_pickup'
    || order.order_channel === 'phone_delivery'
    || order.order_channel === 'instore'
    || order.order_channel === 'third_party'
  ) {
    return order.order_channel;
  }

  if (order.payment_method === 'online') return 'online';
  if (order.customer_name?.trim().toUpperCase() === 'INSTORE') return 'instore';
  return 'phone_pickup';
};

export const shouldPlayOrderSound = (
  order: Pick<Order, 'order_channel' | 'payment_method' | 'customer_name' | 'scheduled_pickup_at'>
) => getOrderChannel(order) === 'online' || Boolean(order.scheduled_pickup_at);

export const getOrderChannelLabel = (order: Order): string => {
  if (order.order_type === 'delivery') return 'Delivery';

  const channel = getOrderChannel(order);
  if (channel === 'instore') {
    return 'Instore';
  }
  if (channel === 'third_party') {
    return order.delivery_partner_name?.trim() || '3rd Party';
  }

  return channel === 'online' ? 'Online Pickup' : 'Phone Pickup';
};

export const getOrderChannelReceiptLabel = (order: Order): string => getOrderChannelLabel(order).toUpperCase();

const KNOWN_ORDER_OPTIONS = new Set([
  'Chicken salt',
  'Salt',
  'Both Salt',
  'No salt at all',
  'Extra Salt',
  'Extra chicken salt',
]);

const splitOrderOptions = (value?: string | null): string[] => (
  (value || '')
    .split(',')
    .map((option) => option.trim())
    .filter(Boolean)
);

export const getOrderOptions = (order: Pick<Order, 'order_options' | 'special_instructions'>): string[] => {
  const explicitOptions = splitOrderOptions(order.order_options);
  const legacyOptions = (order.special_instructions || '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => KNOWN_ORDER_OPTIONS.has(line));

  return Array.from(new Set([...explicitOptions, ...legacyOptions]));
};

export const getOrderNotes = (order: Pick<Order, 'special_instructions'>): string | null => {
  const notes = (order.special_instructions || '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !KNOWN_ORDER_OPTIONS.has(line))
    .join('\n')
    .trim();

  return notes || null;
};

export const getOrderLineItemCount = (order: Pick<Order, 'items'>): number => order.items?.length || 0;

export const DEFAULT_KITCHEN_SECTION = 'Fried';

export const normalizeKitchenSection = (value?: string | null): string | null => {
  const normalized = value?.trim();
  return normalized ? normalized : null;
};

export const parseKitchenSections = (value?: string | null): string[] => {
  const normalized = normalizeKitchenSection(value);
  if (!normalized) return [];

  return Array.from(
    new Set(
      normalized
        .split(',')
        .map((section) => section.trim())
        .filter(Boolean)
    )
  );
};

export const getKitchenSectionKey = (value?: string | null): string =>
  parseKitchenSections(value).join(',');

export const getKitchenSectionDisplay = (value?: string | null): string =>
  parseKitchenSections(value)
    .map((section) => section.toUpperCase())
    .join(' & ');

export const resolveKitchenSections = (
  baseSection?: string | null,
  addons?: OrderItemAddon[],
  fallbackSection?: string | null
): string[] => {
  const addonSections = Array.from(
    new Set(
      (addons || []).flatMap((addon) => parseKitchenSections(addon.section))
    )
  );

  if (addonSections.length > 0) return addonSections;

  const normalizedBase = normalizeKitchenSection(baseSection);
  const normalizedFallback = normalizeKitchenSection(fallbackSection);
  return [normalizedBase || normalizedFallback || DEFAULT_KITCHEN_SECTION];
};

export const formatKitchenSectionValue = (
  baseSection?: string | null,
  addons?: OrderItemAddon[],
  fallbackSection?: string | null
): string => resolveKitchenSections(baseSection, addons, fallbackSection).join(', ');

export const getResolvedKitchenSectionKey = (
  baseSection?: string | null,
  addons?: OrderItemAddon[],
  fallbackSection?: string | null
): string => resolveKitchenSections(baseSection, addons, fallbackSection).join(',');

export const getResolvedKitchenSectionDisplay = (
  baseSection?: string | null,
  addons?: OrderItemAddon[],
  fallbackSection?: string | null
): string => resolveKitchenSections(baseSection, addons, fallbackSection)
  .map((section) => section.toUpperCase())
  .join(' & ');

export type KitchenSectionGroup<TItem> = {
  sectionName: string | null;
  items: TItem[];
};

export type KitchenReceiptCopy<TItem> = {
  key: string;
  copyNumber: number;
  totalCopies: number;
  sections: KitchenSectionGroup<TItem>[];
};

export const buildKitchenReceiptCopies = <TItem extends { section?: string | null; addons?: OrderItemAddon[] }>(
  items: TItem[] | null | undefined,
  getFallbackSection?: (item: TItem) => string | null | undefined
): KitchenReceiptCopy<TItem>[] => {
  const sourceItems = items || [];
  const groups = (() => {
    const map = new Map<string, KitchenSectionGroup<TItem>>();
    for (const item of sourceItems) {
      const sectionKey = getResolvedKitchenSectionKey(item.section, item.addons, getFallbackSection?.(item)) || DEFAULT_KITCHEN_SECTION;
      const sectionName = getResolvedKitchenSectionDisplay(item.section, item.addons, getFallbackSection?.(item)) || DEFAULT_KITCHEN_SECTION.toUpperCase();
      const existing = map.get(sectionKey) || { sectionName, items: [] };
      existing.items.push(item);
      map.set(sectionKey, existing);
    }
    return Array.from(map.values());
  })();

  if (groups.length === 0) {
    return [{
      key: 'copy-1',
      copyNumber: 1,
      totalCopies: 1,
      sections: [{ sectionName: null, items: sourceItems }],
    }];
  }

  return groups.map((group, index) => ({
    key: `copy-${index + 1}`,
    copyNumber: index + 1,
    totalCopies: groups.length,
    sections: [group],
  }));
};

export const paymentSummary = (order: Order): string => {
  const type = getOrderChannelLabel(order);
  if (getOrderChannel(order) === 'third_party') {
    const externalOrderNumber = order.external_order_number?.trim();
    return externalOrderNumber ? `${type} • ID ${externalOrderNumber}` : `${type} • Paid`;
  }
  const payment =
    order.payment_method === 'store'
      ? 'Pay at Counter'
      : order.payment_status === 'paid'
        ? 'Paid Online'
        : 'Online Payment';
  return `${type} • ${payment}`;
};

export const getNextQuickAction = (
  orderOrStatus: Order | OrderStatus
): { action: string; label: string } | null => {
  const currentStatus = typeof orderOrStatus === 'string' ? orderOrStatus : orderOrStatus.order_status;
  const isInstore = typeof orderOrStatus !== 'string' && getOrderChannel(orderOrStatus) === 'instore';

  switch (currentStatus) {
    case 'pending':
      return { action: 'accept', label: 'Accept' };
    case 'confirmed':
      return { action: 'prepare', label: 'Start Preparing' };
    case 'preparing':
      if (isInstore) {
        return { action: 'completed', label: 'Complete' };
      }
      return { action: 'ready', label: 'Mark Ready' };
    case 'ready':
      return { action: 'completed', label: 'Complete' };
    default:
      return null;
  }
};

export const generatePrintHTML = (order: Order): string => {
  const ticketOrderNumber = getFriendlyOrderNumber(order.order_number);
  const rewardPointsUsed = order.reward_points_used ?? 0;
  const rewardPointsValue = order.reward_points_value ?? 0;
  const itemsHTML = order.items?.map(item => {
    const grouped = groupAddons(item.addons || []);
    const addonsHTML = grouped.map(addon =>
      `<li>${addon.quantity > 1 ? `${addon.quantity}x ` : '+ '}${addon.name} (${addon.group}) - $${addon.price.toFixed(2)}</li>`
    ).join('') || '';
    const removedHTML =
      Array.isArray(item.removed_ingredients) && item.removed_ingredients.length > 0
        ? item.removed_ingredients.map(ing => `<p style="margin: 4px 0; font-weight: bold;">No ${ing}</p>`).join('')
        : '';

    return `
      <tr>
        <td>${item.quantity}x ${item.product_name}</td>
        <td>$${item.subtotal.toFixed(2)}</td>
      </tr>
      ${item.comment?.trim() ? `<tr><td colspan="2"><strong style="font-style: italic;">NOTE: ${item.comment}</strong></td></tr>` : ''}
      ${removedHTML ? `<tr><td colspan="2">${removedHTML}</td></tr>` : ''}
      ${addonsHTML ? `<tr><td colspan="2"><ul style="margin: 0; padding-left: 20px;">${addonsHTML}</ul></td></tr>` : ''}
    `;
  }).join('') || '';

  const scheduledPickupAt = order.scheduled_pickup_at ? new Date(order.scheduled_pickup_at) : null;
  const isPreOrder =
    order.order_type === 'pickup' &&
    !!scheduledPickupAt &&
    Number.isFinite(scheduledPickupAt.getTime()) &&
    scheduledPickupAt.getTime() > Date.now();

  const preOrderBannerHTML = isPreOrder
    ? `<div class="preorder-banner">PRE-ORDER</div>
       <div class="pickup-time-hero"><strong>PICKUP TIME:</strong> ${scheduledPickupAt!.toLocaleString()}</div>`
    : '';

  const pickupTimeHTML =
    order.order_type === 'pickup' && order.scheduled_pickup_at
      ? `<p><strong>Pickup time:</strong> ${new Date(order.scheduled_pickup_at).toLocaleString()}</p>`
      : '';

  const paymentStatusText = PAYMENT_STATUS_LABELS[order.payment_status];
  const orderNotes = getOrderNotes(order);
  const lineItemCount = getOrderLineItemCount(order);
  const orderOptionsHTML = getOrderOptions(order)
    .map((option) => `<tr class="order-option-row"><td colspan="2"><strong>ORDER OPTION:</strong> ${option}</td></tr>`)
    .join('');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Order #${ticketOrderNumber}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; font-size: 18px; }
          h1 { margin: 0 0 10px 0; font-size: 30px; }
          .payment-status { font-size: 26px; font-weight: bold; margin: 6px 0 4px 0; }
          .preorder-banner { font-size: 34px; font-weight: 900; text-align: center; margin: 10px 0 8px 0; letter-spacing: 1px; }
          .pickup-time-hero { font-size: 22px; font-weight: 700; text-align: center; margin: 0 0 10px 0; }
          .info { margin: 10px 0; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
          th { background-color: #f2f2f2; }
          .order-option-row td { font-size: 22px; font-weight: 900; }
          .total { font-size: 24px; font-weight: bold; margin-top: 20px; }
          .order-number-bottom { margin-top: 24px; font-size: 32px; font-weight: bold; text-align: center; }
        </style>
      </head>
      <body>
        <h1>Order #${ticketOrderNumber}</h1>
        <div class="payment-status">${paymentStatusText}</div>
        ${preOrderBannerHTML}
        <div class="info">
          <p><strong>Customer:</strong> ${order.customer_name || order.customer_email}</p>
          <p><strong>Phone:</strong> ${order.customer_phone}</p>
          <p><strong>Type:</strong> ${getOrderChannelLabel(order)}</p>
          <p><strong>Order status:</strong> ${STATUS_LABELS[order.order_status]}</p>
          <p><strong>Payment status:</strong> ${paymentStatusText}</p>
          <p><strong>Time placed:</strong> ${new Date(order.created_at).toLocaleString()}</p>
          ${pickupTimeHTML}
          ${order.order_type === 'delivery' && order.delivery_address_line1 ? `
            <p><strong>Delivery Address:</strong><br>
            ${order.delivery_address_line1}<br>
            ${order.delivery_address_line2 ? order.delivery_address_line2 + '<br>' : ''}
            ${order.delivery_city}, ${order.delivery_state} ${order.delivery_postcode}
            </p>
          ` : ''}
          ${orderNotes ? `
          <div style="margin: 15px 0; padding: 10px; background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 4px;">
            <strong>SPECIAL INSTRUCTIONS:</strong><br/>
            ${orderNotes}
          </div>` : ''}
        </div>
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th>Price</th>
            </tr>
          </thead>
          <tbody>
            ${orderOptionsHTML}
            ${itemsHTML}
          </tbody>
        </table>
        <div class="total">
          <p>Total items: ${lineItemCount}</p>
          <p>Subtotal: $${order.subtotal.toFixed(2)}</p>
          ${order.tax > 0 ? `<p>Tax: $${order.tax.toFixed(2)}</p>` : ''}
          ${order.delivery_fee > 0 ? `<p>Delivery Fee: $${order.delivery_fee.toFixed(2)}</p>` : ''}
          ${order.promotion_discount > 0 ? `<p style="color: #16a34a;">${getOrderPromotionSummary(order)?.label || 'Promotion Discount'}: -$${order.promotion_discount.toFixed(2)}</p>` : ''}
          ${order.coupon_discount > 0 ? `<p style="color: #16a34a;">Coupon (${order.coupon_code}): -$${order.coupon_discount.toFixed(2)}</p>` : ''}
          ${rewardPointsUsed > 0 && rewardPointsValue > 0 ? `<p style="color: #16a34a;">Points Applied (${rewardPointsUsed.toLocaleString()} pts): -$${rewardPointsValue.toFixed(2)}</p>` : ''}
          ${order.service_fee > 0 ? `<p>Service Fee: $${order.service_fee.toFixed(2)}</p>` : ''}
          <p>Total: $${order.total.toFixed(2)}</p>
        </div>
        <p class="order-number-bottom">ORDER #${ticketOrderNumber}</p>
      </body>
    </html>
  `;
};

export const getPaymentMethodType = (order: Order): 'card' | 'cash' => {
  const method = (order.payment_method || '').toLowerCase();
  const detail = (order.payment_method_detail || '').toLowerCase();
  const paymentText = `${method} ${detail}`;

  if (method === 'online') return 'card';

  // SmartPay and other terminal/card labels may be stored in either
  // payment_method_detail or older rows' payment_method field.
  if (
    paymentText.includes('card') ||
    paymentText.includes('eftpos') ||
    paymentText.includes('smartpay') ||
    paymentText.includes('visa') ||
    paymentText.includes('mastercard')
  ) {
    return 'card';
  }

  return 'cash';
};
