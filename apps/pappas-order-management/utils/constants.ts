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
