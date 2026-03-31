import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Card, Button as PaperButton, IconButton } from 'react-native-paper';
import type { Order, OrderStatus } from '@my-small-business/types';
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
  onQuickAction: (orderId: string, action: string) => void;
  onStatusUpdate: (orderId: string, status: OrderStatus) => void;
  onPaymentStatusUpdate: (orderId: string, status: string) => void;
}

export const LiveOrderListItem: React.FC<LiveOrderListItemProps> = ({
  order,
  nowMs,
  updatingStatus,
  onOrderPress,
  onCustomerPress,
  onPrintPress,
  onQuickAction,
  onStatusUpdate,
  onPaymentStatusUpdate,
}) => {
  const statusColor = STATUS_COLORS[order.order_status];
  const statusLabel = STATUS_LABELS[order.order_status];
  const paymentColor = PAYMENT_STATUS_COLORS[order.payment_status];
  const paymentLabel = PAYMENT_STATUS_LABELS[order.payment_status];
  const quickAction = getNextQuickAction(order.order_status);
  const elapsed = formatElapsed(order.created_at, nowMs);
  const elapsedColor =
    elapsed && elapsed.minutes < 10 ? '#16a34a' : elapsed && elapsed.minutes < 20 ? '#ca8a04' : '#dc2626';
  const isPaid = order.payment_status === 'paid';

  return (
    <Card style={styles.orderCard} onPress={() => onOrderPress(order)}>
      <Card.Content>
        <View style={styles.orderHeader}>
          <View style={styles.orderHeaderLeft}>
            <Text style={styles.orderNumber}>{getFriendlyOrderNumber(order.order_number)}</Text>
            <TouchableOpacity onPress={() => onCustomerPress(order)}>
              <Text style={styles.customerName}>
                {order.customer_name || order.customer_email}
              </Text>
            </TouchableOpacity>
            <View style={styles.orderMeta}>
              <Text style={styles.orderType}>{paymentSummary(order)}</Text>
            </View>
          </View>
          <View style={styles.badgesContainer}>
            <View style={[styles.elapsedPill, { backgroundColor: elapsedColor }]}>
              <Text style={styles.elapsedText}>{elapsed.text}</Text>
            </View>
            <IconButton
              icon="printer"
              size={20}
              onPress={() => onPrintPress(order)}
              accessibilityLabel="Print order"
            />
          </View>
        </View>

        <View style={styles.orderInfoRow}>
          <View style={styles.orderInfoLeft}>
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
          {quickAction && (
            <PaperButton
              mode="contained"
              onPress={() => onQuickAction(order.id, quickAction.action)}
              disabled={updatingStatus === order.id}
              style={styles.bodyQuickButton}
              contentStyle={styles.bodyQuickButtonContent}
            >
              {quickAction.label}
            </PaperButton>
          )}
        </View>

        <View style={styles.statusControls}>
          <View style={styles.statusControl}>
            <Text style={styles.statusControlLabel}>Status:</Text>
            <View style={styles.statusSelectContainer}>
              <TouchableOpacity
                style={[styles.statusSelect, { backgroundColor: statusColor }]}
                onPress={() => onStatusUpdate(order.id, order.order_status)}
                disabled={updatingStatus === order.id}
              >
                <Text style={styles.statusSelectText}>{statusLabel}</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.statusControl}>
            <Text style={styles.statusControlLabel}>Payment:</Text>
            <View style={styles.statusSelectContainer}>
              <TouchableOpacity
                style={[styles.statusSelect, { backgroundColor: paymentColor }]}
                onPress={() => onPaymentStatusUpdate(order.id, order.payment_status)}
                disabled={updatingStatus === order.id || order.payment_status === 'paid'}
              >
                <Text style={styles.statusSelectText}>{paymentLabel}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  orderCard: {
    marginBottom: 12,
    backgroundColor: '#fff',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    borderRadius: 8,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  orderHeaderLeft: {
    flex: 1,
  },
  orderNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  customerName: {
    fontSize: 16,
    color: '#10b981',
    fontWeight: '600',
    marginTop: 2,
  },
  orderMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  orderType: {
    fontSize: 14,
    color: '#6b7280',
  },
  badgesContainer: {
    alignItems: 'flex-end',
    gap: 4,
  },
  elapsedPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 60,
    alignItems: 'center',
  },
  elapsedText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'Courier',
  },
  orderTime: {
    fontSize: 14,
    color: '#6b7280',
  },
  orderInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#f3f4f6',
  },
  orderInfoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  paymentAttention: {
    fontSize: 12,
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
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  bodyQuickButton: {
    borderRadius: 6,
    backgroundColor: '#2563eb',
  },
  bodyQuickButtonContent: {
    paddingHorizontal: 8,
  },
  statusControls: {
    flexDirection: 'row',
    gap: 12,
  },
  statusControl: {
    flex: 1,
  },
  statusControlLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
    fontWeight: '500',
  },
  statusSelectContainer: {
    borderRadius: 6,
    overflow: 'hidden',
  },
  statusSelect: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  statusSelectText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
});
