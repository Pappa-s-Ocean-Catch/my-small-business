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
  if (!isOpen && (!pickup || !delivery)) return 'Store is currently closed. Please choose pickup/ready and delivery times to pre-order.';
  if (!pickup && !delivery) return null;
  if (!pickup || !delivery) return 'Please choose both pickup/ready and delivery times.';
  const pickupMs = new Date(pickup).getTime();
  const deliveryMs = new Date(delivery).getTime();
  if (!Number.isFinite(pickupMs) || !Number.isFinite(deliveryMs)) return 'Please choose valid pickup and delivery times.';
  if (pickupMs <= now.getTime()) return 'Pickup/ready time must be in the future.';
  if (deliveryMs <= pickupMs) return 'Delivery time must be after pickup/ready time.';
  return null;
}
