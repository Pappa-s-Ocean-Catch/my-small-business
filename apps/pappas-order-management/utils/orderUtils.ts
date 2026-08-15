import type { Order, OrderStatus, OrderItemAddon, OrderChannel } from '@my-small-business/types';

export const KITCHEN_SECTION_OPTIONS = ['Fried', 'Grilled', 'Till'] as const;
export const PRINT_SECTION_OPTIONS = ['Fried', 'Grilled', 'Till', 'Customer Copy'] as const;
export const CUSTOMER_COPY_SECTION = 'Customer Copy';

export const groupAddons = (addons: OrderItemAddon[]) => {
  if (!addons || addons.length === 0) return [];
  
  const grouped: Record<string, { 
    name: string; 
    group: string; 
    price: number; 
    quantity: number 
  }> = {};
  
  addons.forEach(addon => {
    // This helper is called with one parent product's add-ons, so group only
    // same-name, same-price selections even when they come from different groups.
    // We avoid using addon_item_id because it might be unique per order entry in some DB schemas.
    const name = addon.addon_item_name.trim();
    const key = `${name}-${addon.addon_item_price}`;
    if (grouped[key]) {
      grouped[key].quantity += 1;
    } else {
      grouped[key] = {
        name,
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

export const PRE_ORDER_LEAD_MINUTES = 30;

export const getScheduledPickupLeadMinutes = (scheduledPickupAt?: string | null, nowMs: number = Date.now()): number | null => {
  if (!scheduledPickupAt) return null;
  const pickupMs = new Date(scheduledPickupAt).getTime();
  if (!Number.isFinite(pickupMs)) return null;
  return (pickupMs - nowMs) / (1000 * 60);
};

export const isScheduledPreOrder = (
  order: Pick<Order, 'scheduled_pickup_at' | 'order_status' | 'payment_status'>,
  nowMs: number = Date.now(),
  leadMinutes: number = PRE_ORDER_LEAD_MINUTES
): boolean => {
  if (
    order.order_status === 'completed'
    || order.order_status === 'cancelled'
    || order.payment_status === 'refunded'
  ) {
    return false;
  }

  const lead = getScheduledPickupLeadMinutes(order.scheduled_pickup_at, nowMs);
  return lead != null && lead > leadMinutes;
};

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

export type ReceiptHeader = {
  label: string;
  logo: 'uber_eats' | 'doordash' | null;
};

export const getReceiptHeader = (order: Order): ReceiptHeader => {
  const channel = getOrderChannel(order);
  const partner = order.delivery_partner_name?.trim().toLowerCase();

  if (channel === 'third_party' && partner === 'uber eats') {
    return { label: 'DELIVERY', logo: 'uber_eats' };
  }
  if (channel === 'third_party' && partner === 'doordash') {
    return { label: 'DELIVERY', logo: 'doordash' };
  }
  if (channel === 'instore') {
    return { label: 'INSTORE', logo: null };
  }
  if (channel === 'phone_pickup') {
    return { label: 'PHONE PICKUP', logo: null };
  }
  if (channel === 'phone_delivery') {
    return { label: 'PHONE DELIVERY', logo: null };
  }

  return { label: getOrderChannelReceiptLabel(order), logo: null };
};

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

export const getOrderItemDisplaySubtotal = (
  item: Pick<NonNullable<Order['items']>[number], 'override_price' | 'subtotal'>
): number => (
  item.override_price != null ? Number(item.override_price) : Number(item.subtotal || 0)
);

export const getOrderDisplaySubtotal = (
  order: Pick<Order, 'subtotal' | 'items'>
): number => {
  const items = order.items || [];
  const hasOverridePrice = items.some((item) => item.override_price != null);
  if (!hasOverridePrice) return Number(order.subtotal || 0);
  return items.reduce((sum, item) => sum + getOrderItemDisplaySubtotal(item), 0);
};

export const getOrderDisplayTotal = (
  order: Pick<
    Order,
    | 'subtotal'
    | 'tax'
    | 'delivery_fee'
    | 'service_fee'
    | 'promotion_discount'
    | 'coupon_discount'
    | 'reward_points_value'
    | 'total'
    | 'items'
  >
): number => {
  const items = order.items || [];
  const hasOverridePrice = items.some((item) => item.override_price != null);
  if (!hasOverridePrice) return Number(order.total || 0);

  return Math.max(
    0,
    getOrderDisplaySubtotal(order)
      + Number(order.tax || 0)
      + Number(order.delivery_fee || 0)
      + Number(order.service_fee || 0)
      - Number(order.promotion_discount || 0)
      - Number(order.coupon_discount || 0)
      - Number(order.reward_points_value || 0)
  );
};

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

export const shouldSkipOverlappingCombinedSectionTicket = (
  sectionName: string | null | undefined,
  allSectionNames: Array<string | null | undefined>,
): boolean => {
  const normalizedSection = sectionName?.trim().toLowerCase() || '';
  const combinedParts = normalizedSection
    .split('&')
    .map((part) => part.trim())
    .filter(Boolean);
  if (combinedParts.length < 2) return false;

  const individualSections = new Set(
    allSectionNames
      .map((name) => name?.trim().toLowerCase() || '')
      .filter((name) => name && !name.includes('&')),
  );
  return combinedParts.some((part) => individualSections.has(part));
};

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

export const formatOrderPaymentMethod = (
  order: Pick<Order, 'payment_method' | 'payment_method_detail'>
): string => {
  const rawMethod = order.payment_method_detail || order.payment_method;
  if (!rawMethod) return 'Not recorded';
  return rawMethod
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
};

export type PaymentMethodType = 'card' | 'cash';
export type PaymentStatType = PaymentMethodType | 'marketplace';

export const getPaymentMethodType = (order: Order): PaymentMethodType => {
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

export const getPaymentStatType = (order: Order): PaymentStatType => {
  if (order.order_channel?.toLowerCase() === 'third_party') return 'marketplace';
  return getPaymentMethodType(order);
};

export const getPaymentStatLabel = (order: Order): 'Card' | 'Cash' | 'Marketplace' => {
  const type = getPaymentStatType(order);
  if (type === 'marketplace') return 'Marketplace';
  return type === 'card' ? 'Card' : 'Cash';
};
