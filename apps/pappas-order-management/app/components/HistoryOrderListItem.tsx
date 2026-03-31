import React from 'react';
import { View, Text, StyleSheet, useWindowDimensions, TouchableOpacity } from 'react-native';
import { Card, IconButton } from 'react-native-paper';
import type { Order } from '@my-small-business/types';
import { getFriendlyOrderNumber } from '../utils/orderNumber';
import { STATUS_COLORS, STATUS_LABELS, PAYMENT_STATUS_COLORS, PAYMENT_STATUS_LABELS } from '../utils/constants';

interface HistoryOrderListItemProps {
  order: Order;
  onOrderPress: (order: Order) => void;
  onCustomerPress: (order: Order) => void;
}

export const HistoryOrderListItem: React.FC<HistoryOrderListItemProps> = ({
  order,
  onOrderPress,
  onCustomerPress,
}) => {
  const { width } = useWindowDimensions();
  const isLandscape = width > 600; // Threshold for 1-line layout

  const statusColor = STATUS_COLORS[order.order_status];
  const statusLabel = STATUS_LABELS[order.order_status];
  const paymentColor = PAYMENT_STATUS_COLORS[order.payment_status];
  const paymentLabel = PAYMENT_STATUS_LABELS[order.payment_status];
  const isPaid = order.payment_status === 'paid';

  if (isLandscape) {
    // 1-line layout
    return (
      <Card style={styles.card} onPress={() => onOrderPress(order)}>
        <Card.Content style={styles.landscapeContent}>
          <View style={styles.orderNumContainer}>
            <Text style={styles.orderNumber}>#{getFriendlyOrderNumber(order.order_number)}</Text>
          </View>
          
          <TouchableOpacity style={styles.customerContainer} onPress={() => onCustomerPress(order)}>
            <Text style={styles.customerName} numberOfLines={1}>
              {order.customer_name || order.customer_email}
            </Text>
          </TouchableOpacity>

          <View style={styles.statusContainer}>
            <View style={[styles.badge, { backgroundColor: statusColor }]}>
              <Text style={styles.badgeText}>{statusLabel}</Text>
            </View>
          </View>

          <View style={styles.paymentContainer}>
            <View style={[styles.badge, { backgroundColor: paymentColor }]}>
              <Text style={styles.badgeText}>{paymentLabel}</Text>
            </View>
          </View>

          <View style={styles.timeContainer}>
            <Text style={styles.orderTime}>{new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
          </View>

          <View style={styles.totalContainer}>
            <Text style={styles.orderTotal}>${order.total.toFixed(2)}</Text>
          </View>
        </Card.Content>
      </Card>
    );
  }

  // 2-line portrait layout
  return (
    <Card style={styles.card} onPress={() => onOrderPress(order)}>
      <Card.Content style={styles.portraitContent}>
        <View style={styles.portraitRow}>
          <Text style={styles.orderNumber}>#{getFriendlyOrderNumber(order.order_number)}</Text>
          <TouchableOpacity style={styles.portraitCustomerWrapper} onPress={() => onCustomerPress(order)}>
            <Text style={styles.customerName} numberOfLines={1}>
              {order.customer_name || order.customer_email}
            </Text>
          </TouchableOpacity>
          <Text style={styles.orderTime}>{new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
        </View>
        <View style={[styles.portraitRow, { marginTop: 8 }]}>
          <View style={styles.badgesGroup}>
            <View style={[styles.badge, { backgroundColor: statusColor, marginRight: 6 }]}>
              <Text style={styles.badgeText}>{statusLabel}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: paymentColor }]}>
              <Text style={styles.badgeText}>{paymentLabel}</Text>
            </View>
          </View>
          <View style={styles.totalGroup}>
            <Text style={styles.orderTotal}>${order.total.toFixed(2)}</Text>
          </View>
        </View>
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: 8,
    backgroundColor: '#fff',
    elevation: 1,
    borderRadius: 8,
  },
  landscapeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  portraitContent: {
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  portraitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderNumContainer: {
    width: 70,
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    marginRight: 12,
  },
  customerContainer: {
    flex: 2,
    paddingRight: 12,
  },
  portraitCustomerWrapper: {
    flex: 1,
    paddingHorizontal: 12,
  },
  customerName: {
    fontSize: 15,
    color: '#10b981',
    fontWeight: '600',
    flex: 1,
  },
  statusContainer: {
    width: 100,
    alignItems: 'center',
  },
  paymentContainer: {
    width: 100,
    alignItems: 'center',
  },
  totalContainer: {
    width: 80,
    alignItems: 'flex-end',
  },
  orderTotal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2563eb',
  },
  timeContainer: {
    width: 80,
    alignItems: 'flex-end',
  },
  orderTime: {
    fontSize: 13,
    color: '#6b7280',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    minWidth: 80,
    alignItems: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  printIcon: {
    margin: 0,
    marginLeft: 8,
  },
  badgesGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  totalGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  printIconPortrait: {
    margin: 0,
    marginLeft: 4,
  },
});
