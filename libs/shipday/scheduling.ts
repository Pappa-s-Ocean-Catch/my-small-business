/** Scheduled delivery is the customer choice; driver pickup/food ready is ten minutes earlier. */
export function getPickupTimeForDelivery(deliveryAt?: string | null): string | null {
  if (!deliveryAt) return null;
  const timestamp = new Date(deliveryAt).getTime();
  return Number.isFinite(timestamp) ? new Date(timestamp - 10 * 60000).toISOString() : null;
}

interface ScheduledOrder {
  created_at?: string | null;
  scheduled_pickup_at?: string | null;
  scheduled_delivery_at?: string | null;
  delivery_eta_minutes?: number | null;
}

/** Restaurant pickup is also the planned food-ready time. */
export function getDeliverySchedule(order: ScheduledOrder) {
  const pickup = order.scheduled_pickup_at
    ? new Date(order.scheduled_pickup_at)
    : new Date(new Date(order.created_at || new Date().toISOString()).getTime() + 10 * 60000);
  const delivery = order.scheduled_delivery_at
    ? new Date(order.scheduled_delivery_at)
    : new Date(pickup.getTime() + (Number(order.delivery_eta_minutes) > 0 ? Number(order.delivery_eta_minutes) : 30) * 60000);
  if (!Number.isFinite(pickup.getTime()) || !Number.isFinite(delivery.getTime()) || delivery <= pickup) {
    throw new Error('Invalid delivery schedule');
  }
  return { expected_pickup_at: pickup.toISOString(), expected_delivery_at: delivery.toISOString() };
}

export function validateDeliverySchedule(isOpen: boolean, pickup?: string | null, delivery?: string | null, now = new Date()): string | null {
  if (!isOpen && (!pickup || !delivery)) return 'Store is currently closed. Please choose a delivery time to pre-order.';
  if (!pickup && !delivery) return null;
  if (!pickup || !delivery) return 'Please choose a delivery time.';
  const pickupMs = new Date(pickup).getTime();
  const deliveryMs = new Date(delivery).getTime();
  if (!Number.isFinite(pickupMs) || !Number.isFinite(deliveryMs)) return 'Please choose a valid delivery time.';
  if (pickupMs <= now.getTime()) return 'Please choose a later delivery time.';
  if (deliveryMs <= pickupMs) return 'Please choose a later delivery time.';
  return null;
}
