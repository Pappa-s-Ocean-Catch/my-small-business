type SessionStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
type OrderType = 'pickup' | 'delivery';

export function getSessionOrderType(storage: Pick<SessionStorage, 'getItem'>): OrderType {
  const canonical = storage.getItem('orderType');
  if (canonical === 'pickup' || canonical === 'delivery') return canonical;
  return storage.getItem('order_type') === 'delivery' ? 'delivery' : 'pickup';
}

export function getSessionSchedule(storage: Pick<SessionStorage, 'getItem'>, orderType: OrderType): {
  option: 'asap' | 'scheduled'; pickupAt: string | null; deliveryDelayMinutes: string;
} {
  const empty = { option: 'asap' as const, pickupAt: null, deliveryDelayMinutes: '' };
  if (getSessionOrderType(storage) !== orderType || storage.getItem('pickupOption') !== 'scheduled') return empty;
  const pickup = new Date(storage.getItem('scheduledPickupAt') || '');
  const delivery = new Date(storage.getItem('scheduledDeliveryAt') || '');
  const pickupAt = Number.isFinite(pickup.getTime()) ? pickup.toISOString() : null;
  const delay = (delivery.getTime() - pickup.getTime()) / 60000;
  return {
    option: 'scheduled', pickupAt,
    deliveryDelayMinutes: orderType === 'delivery' && [15, 30, 45, 60, 75, 90].includes(delay) ? String(delay) : '',
  };
}

export function setSessionOrderType(storage: SessionStorage, type: OrderType): void {
  if (getSessionOrderType(storage) !== type) {
    storage.removeItem('pickupOption');
    storage.removeItem('scheduledPickupAt');
    storage.removeItem('scheduledDeliveryAt');
  }
  storage.setItem('orderType', type);
  storage.setItem('order_type', type);
}

/** Schedules and quotes belong to the current cart, not the next order. */
export function clearSessionSchedule(storage: Pick<SessionStorage, 'removeItem'>): void {
  for (const key of ['pickupOption', 'scheduledPickupAt', 'scheduledDeliveryAt', 'deliveryQuote', 'delivery_quote']) {
    storage.removeItem(key);
  }
}
