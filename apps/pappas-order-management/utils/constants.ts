import type { OrderStatus, PaymentStatus } from '@my-small-business/types';

export const STATUS_COLORS: Record<OrderStatus, string> = {
  pending: '#f59e0b',
  pending_online_payment: '#f59e0b',
  confirmed: '#3b82f6',
  preparing: '#8b5cf6',
  ready: '#10b981',
  completed: '#6b7280',
  cancelled: '#ef4444',
};

export const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Pending',
  pending_online_payment: 'Waiting for Payment',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  ready: 'Ready',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const PAYMENT_STATUS_COLORS: Record<PaymentStatus, string> = {
  pending: '#f59e0b',
  paid: '#10b981',
  failed: '#ef4444',
  refunded: '#6b7280',
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: 'Pending',
  paid: 'Paid',
  failed: 'Failed',
  refunded: 'Refunded',
};

export const DELIVERY_STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  assigned: '#2563eb',
  driver_assigned: '#2563eb',
  inflight: '#7c3aed',
  picked_up: '#7c3aed',
  in_transit: '#7c3aed',
  delivered: '#10b981',
  cancelled: '#ef4444',
  failed: '#ef4444',
};

export const DELIVERY_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending Driver',
  assigned: 'Driver Assigned',
  driver_assigned: 'Driver Assigned',
  inflight: 'On The Way',
  picked_up: 'On The Way',
  in_transit: 'On The Way',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  failed: 'Delivery Failed',
};

export const getDeliveryStatusLabel = (status?: string | null): string => {
  if (!status) return 'Pending Driver';
  return DELIVERY_STATUS_LABELS[status] || status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

export const getDeliveryStatusColor = (status?: string | null): string =>
  (status && DELIVERY_STATUS_COLORS[status]) || DELIVERY_STATUS_COLORS.pending;
