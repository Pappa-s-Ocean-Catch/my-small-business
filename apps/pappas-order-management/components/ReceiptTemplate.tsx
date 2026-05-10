import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { Order } from '@my-small-business/types';
import { groupAddons } from '../utils/orderUtils';

interface ReceiptTemplateProps {
  order: Order;
  width?: number;
}

export const ReceiptTemplate: React.FC<ReceiptTemplateProps> = ({ order, width = 576 }) => {
  const formatMoney = (amount: number) => {
    return (amount || 0).toFixed(2);
  };

  const createdDate = new Date(order.created_at).toLocaleString();
  const pickupDisplay = order.scheduled_pickup_at
    ? new Date(order.scheduled_pickup_at).toLocaleString([], {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
    : null;

  return (
    <View style={[styles.container, { width }]}>
      {/* Header */}
      {pickupDisplay && (
        <View style={styles.preOrderContainer}>
          <Text style={styles.preOrderLabel}>*** PRE-ORDER ***</Text>
          <Text style={styles.preOrderTime}>PICKUP: {pickupDisplay}</Text>
        </View>
      )}

      <Text style={styles.headerText}>{createdDate}</Text>
      <Text style={styles.headerText}>
        {order.order_type?.toUpperCase()} • {order.payment_method?.toUpperCase()}
      </Text>

      <View style={styles.divider} />

      {/* Customer Info */}
      <View style={styles.section}>
        <Text style={styles.largeBoldText}>{order.customer_name || order.customer_email}</Text>
        {order.customer_phone && <Text style={styles.largeBoldText}>{order.customer_phone}</Text>}
        {order.order_type === 'delivery' && order.delivery_address_line1 && (
          <View style={styles.deliveryContainer}>
            <Text style={styles.normalText}>Delivery Address:</Text>
            <Text style={styles.boldText}>{order.delivery_address_line1}</Text>
            {order.delivery_address_line2 && <Text style={styles.boldText}>{order.delivery_address_line2}</Text>}
            <Text style={styles.boldText}>
              {[order.delivery_city, order.delivery_state, order.delivery_postcode].filter(Boolean).join(' ')}
            </Text>
          </View>
        )}
      </View>

      {order.special_instructions?.trim() && (
        <View style={styles.noteSection}>
          <Text style={styles.noteTitle}>ORDER NOTES:</Text>
          <Text style={styles.noteText}>{order.special_instructions}</Text>
        </View>
      )}

      <View style={styles.divider} />

      {/* Items */}
      {order.items?.map((item, idx) => (
        <View key={idx} style={styles.itemContainer}>
          <View style={styles.itemLineRow}>
            <Text style={styles.itemNameLine} numberOfLines={3}>
              {item.quantity}x {item.product_name}
            </Text>
            <Text style={styles.itemLinePrice}>${formatMoney(item.subtotal)}</Text>
          </View>
          {groupAddons(item.addons || []).map((addon, aIdx) => (
            <Text key={aIdx} style={styles.addonText}>
              {addon.quantity > 1 ? `${addon.quantity}x ` : '+ '}{addon.name} {addon.price ? `($${formatMoney(addon.price)})` : ''}
            </Text>
          ))}
          {item.removed_ingredients && item.removed_ingredients.length > 0 && (
            <Text style={styles.removedText}>
              REMOVE: {item.removed_ingredients.join(', ')}
            </Text>
          )}
          {item.comment?.trim() && (
            <Text style={styles.itemNote}>
              Notes: {item.comment}
            </Text>
          )}
        </View>
      ))}

      <View style={styles.divider} />

      {/* Totals */}
      <View style={styles.totalsContainer}>
        <View style={styles.totalRow}>
          <Text style={styles.normalText}>Subtotal:</Text>
          <Text style={styles.normalText}>${formatMoney(order.subtotal)}</Text>
        </View>
        {order.tax > 0 && (
          <View style={styles.totalRow}>
            <Text style={styles.normalText}>Tax:</Text>
            <Text style={styles.normalText}>${formatMoney(order.tax)}</Text>
          </View>
        )}
        {order.promotion_discount > 0 && (
          <View style={styles.totalRow}>
            <Text style={styles.normalText}>Promotions:</Text>
            <Text style={styles.normalText}>-${formatMoney(order.promotion_discount)}</Text>
          </View>
        )}
        {order.coupon_discount > 0 && (
          <View style={styles.totalRow}>
            <Text style={styles.normalText}>Coupon ({order.coupon_code}):</Text>
            <Text style={styles.normalText}>-${formatMoney(order.coupon_discount)}</Text>
          </View>
        )}
        {order.service_fee > 0 && (
          <View style={styles.totalRow}>
            <Text style={styles.normalText}>Service Fee:</Text>
            <Text style={styles.normalText}>${formatMoney(order.service_fee)}</Text>
          </View>
        )}
        <View style={[styles.totalRow, { marginTop: 8 }]}>
          <Text style={styles.largeTotalText}>TOTAL:</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={styles.largeTotalText}>${formatMoney(order.total)}</Text>
            <Text style={styles.statusBadge}>
              {order.payment_status?.toUpperCase() === 'PAID' ? 'PAID' : 'UNPAID'}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.orderNumberContainer}>
        <Text style={styles.orderNumberText}>
          P{order.order_number?.split('-').pop()?.replace(/\D+/g, '')}
        </Text>
      </View>
      <View style={styles.footerContainer}>
        <Text style={styles.footerText}>Thanks for your order!</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  preOrderContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  preOrderLabel: {
    fontSize: 48,
    fontWeight: 'bold',
  },
  preOrderTime: {
    fontSize: 48,
    fontWeight: '600',
  },
  headerText: {
    fontSize: 30,
    color: '#000',
    textAlign: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: '#000',
    marginVertical: 12,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderRadius: 1,
  },
  section: {
    marginBottom: 12,
  },
  normalText: {
    fontSize: 30,
    color: '#000',
  },
  boldText: {
    fontSize: 30,
    fontWeight: 'bold',
    color: '#000',
  },
  largeBoldText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#000',
  },
  deliveryContainer: {
    marginTop: 4,
  },
  itemContainer: {
    marginBottom: 12,
  },
  itemLineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  itemNameLine: {
    flex: 1,
    fontSize: 36,
    fontWeight: 'bold',
    color: '#000',
    lineHeight: 40,
  },
  itemLinePrice: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#000',
    lineHeight: 40,
  },
  addonText: {
    fontSize: 30,
    color: '#000',
    marginLeft: 10,
    lineHeight: 36,
  },
  noteSection: {
    marginBottom: 16,
    padding: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  noteTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 4,
  },
  noteText: {
    fontSize: 28,
    color: '#000',
  },
  itemNote: {
    fontSize: 28,
    fontStyle: 'italic',
    fontWeight: 'bold',
    color: '#000',
    marginTop: 4,
    marginLeft: 10,
  },
  removedText: {
    fontSize: 26,
    color: '#000',
    fontWeight: 'bold',
    marginTop: 4,
    marginLeft: 10,
    textDecorationLine: 'line-through',
  },
  totalsContainer: {
    marginTop: 12,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  largeTotalText: {
    fontSize: 30,
    fontWeight: 'bold',
    color: '#000',
  },
  statusBadge: {
    fontSize: 30,
    fontWeight: 'bold',
    color: '#000',
    borderWidth: 1,
    paddingHorizontal: 4,
    marginLeft: 10,
  },
  orderNumberContainer: {
    marginTop: 20,
    alignItems: 'center',
    marginBottom: 10,
  },
  orderNumberText: {
    fontSize: 48,
    fontWeight: '900',
    color: '#000',
  },
  footerContainer: {
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 10,
  },
  footerText: {
    fontSize: 30,
    color: '#000',
    fontStyle: 'italic',
  },
});
