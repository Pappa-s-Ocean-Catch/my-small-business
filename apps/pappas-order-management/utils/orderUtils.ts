import type { Order, OrderStatus, OrderItemAddon } from '@my-small-business/types';
import { getFriendlyOrderNumber } from './orderNumber';
import { STATUS_LABELS, PAYMENT_STATUS_LABELS } from './constants';

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
    const key = `${addon.addon_item_name}-${addon.addon_group_name}-${addon.addon_item_price}`;
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
  const base = process.env.EXPO_PUBLIC_API_URL || '';
  if (base.endsWith('/')) return base + path.replace(/^\//, '');
  return base + (path.startsWith('/') ? path : '/' + path);
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

export const paymentSummary = (order: Order): string => {
  const type = order.order_type === 'delivery' ? 'Delivery' : 'Pickup';
  const payment =
    order.payment_method === 'store'
      ? 'Pay at Counter'
      : order.payment_status === 'paid'
        ? 'Paid Online'
        : 'Online Payment';
  return `${type} • ${payment}`;
};

export const getNextQuickAction = (currentStatus: OrderStatus): { action: string; label: string } | null => {
  switch (currentStatus) {
    case 'pending':
      return { action: 'accept', label: 'Accept' };
    case 'confirmed':
      return { action: 'prepare', label: 'Start Preparing' };
    case 'preparing':
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
          <p><strong>Type:</strong> ${order.order_type === 'delivery' ? 'Delivery' : 'Pickup'}</p>
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
          ${order.special_instructions?.trim() ? `
          <div style="margin: 15px 0; padding: 10px; background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 4px;">
            <strong>SPECIAL INSTRUCTIONS:</strong><br/>
            ${order.special_instructions}
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
            ${itemsHTML}
          </tbody>
        </table>
        <div class="total">
          <p>Subtotal: $${order.subtotal.toFixed(2)}</p>
          ${order.tax > 0 ? `<p>Tax: $${order.tax.toFixed(2)}</p>` : ''}
          ${order.delivery_fee > 0 ? `<p>Delivery Fee: $${order.delivery_fee.toFixed(2)}</p>` : ''}
          ${order.promotion_discount > 0 ? `<p style="color: #16a34a;">Promotion Discount: -$${order.promotion_discount.toFixed(2)}</p>` : ''}
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
  if (order.payment_method === 'online') return 'card';
  if (order.payment_method === 'store') {
    const detail = (order.payment_method_detail || '').toLowerCase();
    // Common card-related terms for in-store payments
    if (detail.includes('card') || detail.includes('eftpos') || detail.includes('visa') || detail.includes('mastercard')) {
      return 'card';
    }
  }
  return 'cash';
};
