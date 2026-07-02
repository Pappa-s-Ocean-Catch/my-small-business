import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Card, Button as PaperButton, IconButton } from 'react-native-paper';
import type { Order, OrderStatus, PaymentStatus } from '@my-small-business/types';
import { getFriendlyOrderNumber } from '../utils/orderNumber';
import { STATUS_COLORS, STATUS_LABELS, PAYMENT_STATUS_COLORS, PAYMENT_STATUS_LABELS } from '../utils/constants';
import { paymentSummary, getNextQuickAction, formatElapsed } from '../utils/orderUtils';

interface LiveOrderListItemProps {
  order: Order;
  nowMs: number;
  updatingStatus: string | null;
  onOrderPress: (order: Order) => void;
  onCustomerPress: (order: Order) => void;
  onPrintPress: (order: Order) => void;
  onQuickAction: (order: Order, action: string) => void;
  onSmartpayPayment?: (order: Order) => void;
  smartpayPaired?: boolean;
  smartpayProcessing?: boolean;
  onStatusUpdate: (order: Order, status: OrderStatus) => void;
  onPaymentStatusUpdate: (orderId: string, status: PaymentStatus, paymentMethodDetail?: string | null) => void;
}

export const LiveOrderListItem: React.FC<LiveOrderListItemProps> = ({
  order,
  nowMs,
  updatingStatus,
  onOrderPress,
  onCustomerPress,
  onPrintPress,
  onQuickAction,
  onSmartpayPayment,
  smartpayPaired = false,
  smartpayProcessing = false,
  onStatusUpdate,
  onPaymentStatusUpdate,
}) => {
  const statusColor = STATUS_COLORS[order.order_status];
  const statusLabel = STATUS_LABELS[order.order_status];
  const paymentColor = PAYMENT_STATUS_COLORS[order.payment_status];
  const paymentLabel = PAYMENT_STATUS_LABELS[order.payment_status];
  const quickAction = getNextQuickAction(order);
  const elapsed = formatElapsed(order.created_at, nowMs, order.scheduled_pickup_at);
  const elapsedColor = elapsed.isCountdown
    ? !elapsed.overdue && elapsed.minutes > 15
      ? '#16a34a'
      : !elapsed.overdue
      ? '#ca8a04'
      : '#dc2626'
    : elapsed.minutes < 10
    ? '#16a34a'
    : elapsed.minutes < 20
    ? '#ca8a04'
    : '#dc2626';
  const isPaid = order.payment_status === 'paid';
  const canSmartpay =
    smartpayPaired &&
    !!onSmartpayPayment &&
    order.payment_status !== 'paid' &&
    order.order_status !== 'completed' &&
    order.order_status !== 'cancelled';
  const canUpdatePayment =
    updatingStatus !== order.id &&
    order.payment_status !== 'paid' &&
    order.order_status !== 'completed' &&
    order.order_status !== 'cancelled';

  return (
    <Card style={styles.orderCard} onPress={() => onOrderPress(order)}>
      <Card.Content style={styles.cardContent}>
        <View style={styles.topRow}>
          <View style={styles.identityBlock}>
            <View style={styles.titleRow}>
              <Text style={styles.orderNumber}>{getFriendlyOrderNumber(order.order_number)}</Text>
              <View
                style={[
                  styles.pickupBadge,
                  order.scheduled_pickup_at ? styles.pickupScheduled : styles.pickupAsap,
                ]}
              >
                <Text style={styles.pickupText}>
                  {order.scheduled_pickup_at
                    ? `PICKUP ${new Date(order.scheduled_pickup_at).toLocaleString([], {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}`
                    : 'ASAP'}
                </Text>
              </View>
            </View>
            <View style={styles.metaRow}>
              <TouchableOpacity onPress={() => onCustomerPress(order)}>
                <Text style={styles.customerName} numberOfLines={1}>
                  {order.customer_name || order.customer_email}
                </Text>
              </TouchableOpacity>
              <Text style={styles.metaDot}>•</Text>
              <Text style={styles.orderType} numberOfLines={1}>
                {paymentSummary(order)}
              </Text>
            </View>
          </View>

          <View style={styles.urgencyBlock}>
            <View style={[styles.elapsedPill, { backgroundColor: elapsedColor }]}>
              <Text style={styles.elapsedText}>{elapsed.text}</Text>
            </View>
          </View>
        </View>

        <View style={styles.bottomRow}>
          <View style={styles.moneyBlock}>
            <Text
              style={[
                styles.paymentAttention,
                isPaid ? styles.paymentAttentionPaid : styles.paymentAttentionUnpaid,
              ]}
            >
              {isPaid ? 'PAID' : 'UNPAID'}
            </Text>
            <Text style={styles.orderTotal}>${order.total.toFixed(2)}</Text>
          </View>

          <View style={styles.controlsRow}>
            <View style={styles.statusControls}>
              <View style={styles.statusControl}>
                <Text style={styles.statusControlLabel}>Status</Text>
                <View style={styles.statusSelectContainer}>
                  <TouchableOpacity
                    style={[styles.statusSelect, { backgroundColor: statusColor }]}
                    onPress={() => onStatusUpdate(order, order.order_status)}
                    disabled={updatingStatus === order.id}
                  >
                    <Text style={styles.statusSelectText}>{statusLabel}</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <View style={styles.statusControl}>
                <Text style={styles.statusControlLabel}>Payment</Text>
                <View style={styles.statusSelectContainer}>
                  <TouchableOpacity
                    style={[styles.statusSelect, { backgroundColor: paymentColor }]}
                    onPress={() => onPaymentStatusUpdate(order.id, order.payment_status)}
                    disabled={!canUpdatePayment}
                  >
                    <Text style={styles.statusSelectText}>{paymentLabel}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <View style={styles.actionsCluster}>
              <IconButton
                icon="printer"
                size={18}
                onPress={() => onPrintPress(order)}
                accessibilityLabel="Print order"
                style={styles.printButton}
              />
              {canSmartpay && (
                <PaperButton
                  mode="outlined"
                  icon="credit-card-wireless-outline"
                  onPress={() => onSmartpayPayment(order)}
                  loading={smartpayProcessing}
                  disabled={smartpayProcessing || updatingStatus === order.id}
                  style={styles.bodySmartpayButton}
                  contentStyle={styles.bodySmartpayButtonContent}
                  labelStyle={styles.secondaryActionLabel}
                  compact
                >
                  SmartPay
                </PaperButton>
              )}
              {quickAction && (
                <PaperButton
                  mode="contained"
                  onPress={() => onQuickAction(order, quickAction.action)}
                  disabled={updatingStatus === order.id || smartpayProcessing}
                  style={styles.bodyQuickButton}
                  contentStyle={styles.bodyQuickButtonContent}
                  labelStyle={styles.primaryActionLabel}
                  compact
                >
                  {quickAction.label}
                </PaperButton>
              )}
            </View>
          </View>
        </View>
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  orderCard: {
    marginBottom: 8,
    backgroundColor: '#fff',
    elevation: 0,
    shadowOpacity: 0,
    shadowRadius: 0,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cardContent: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  identityBlock: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  orderNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  metaRow: {
    marginTop: 3,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  customerName: {
    fontSize: 14,
    color: '#10b981',
    fontWeight: '600',
  },
  metaDot: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '700',
  },
  orderType: {
    fontSize: 13,
    color: '#6b7280',
  },
  pickupBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  pickupScheduled: {
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#f97316',
  },
  pickupAsap: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#22c55e',
  },
  pickupText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#374151',
  },
  urgencyBlock: {
    alignItems: 'flex-end',
  },
  elapsedPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 88,
    alignItems: 'center',
    justifyContent: 'center',
  },
  elapsedText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
    fontFamily: 'Courier',
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: '#f3f4f6',
    gap: 10,
  },
  moneyBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 0,
  },
  paymentAttention: {
    fontSize: 11,
    fontWeight: '900',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  paymentAttentionPaid: {
    backgroundColor: '#ecfdf5',
    color: '#10b981',
  },
  paymentAttentionUnpaid: {
    backgroundColor: '#fef2f2',
    color: '#ef4444',
  },
  orderTotal: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  controlsRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  statusControls: {
    flexDirection: 'row',
    gap: 8,
    flex: 1,
    marginRight: 8,
  },
  statusControl: {
    minWidth: 88,
  },
  statusControlLabel: {
    fontSize: 10,
    color: '#6b7280',
    marginBottom: 3,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  statusSelectContainer: {
    borderRadius: 6,
    overflow: 'hidden',
  },
  statusSelect: {
    paddingVertical: 7,
    paddingHorizontal: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusSelectText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  actionsCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    flexShrink: 1,
  },
  printButton: {
    margin: 0,
    width: 34,
    height: 34,
    borderRadius: 6,
    backgroundColor: '#f3f4f6',
  },
  bodySmartpayButton: {
    borderRadius: 6,
    borderColor: '#2563eb',
    minHeight: 34,
  },
  bodySmartpayButtonContent: {
    height: 34,
    paddingHorizontal: 8,
  },
  bodyQuickButton: {
    borderRadius: 6,
    backgroundColor: '#1d4ed8',
    minHeight: 36,
  },
  bodyQuickButtonContent: {
    height: 36,
    paddingHorizontal: 10,
  },
  secondaryActionLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  primaryActionLabel: {
    fontSize: 13,
    fontWeight: '800',
  },
});
