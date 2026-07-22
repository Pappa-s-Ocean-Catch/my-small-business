import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Order } from '@my-small-business/types';
import { ReceiptQrCode } from './ReceiptQrCode';
import { getReceiptOrderClaimUrl, getReceiptQrLandingUrl, getReceiptStoreAddressLines, getReceiptStoreName, getReceiptStorePhone, getReceiptWebsiteUrl } from '../lib/receipt-config';
import { getOrderChannelReceiptLabel, getOrderLineItemCount, getOrderNotes, groupAddons } from '../utils/orderUtils';
import { getOrderPromotionSummary, isFreePromotionOrderItem } from '../lib/promotion-summary';

type Props = {
  order: Order;
  width?: number;
};

function formatMoney(amount: number) {
  return (amount || 0).toFixed(2);
}

export function CustomerReceiptTemplate({ order, width = 576 }: Props) {
  const siteUrl = getReceiptWebsiteUrl();
  const qrLandingUrl = getReceiptQrLandingUrl();
  const claimQrUrl = order.receipt_claim_token ? getReceiptOrderClaimUrl(order.receipt_claim_token) : null;
  console.log('[CustomerReceiptTemplate] render', {
    orderId: order.id,
    orderNumber: order.order_number,
    customerName: order.customer_name,
    userId: order.user_id,
    receiptClaimToken: order.receipt_claim_token,
    claimQrUrl,
  });
  const storeName = getReceiptStoreName();
  const addressLines = getReceiptStoreAddressLines();
  const storePhone = getReceiptStorePhone();
  const orderNotes = getOrderNotes(order);
  const rewardPointsUsed = order.reward_points_used ?? 0;
  const rewardPointsValue = order.reward_points_value ?? 0;
  const rewardPointsBalance = Number((order as Order & { reward_points_balance?: number | null }).reward_points_balance ?? 0);
  const promotionSummary = getOrderPromotionSummary(order);
  const promotionLabel = promotionSummary?.label || 'Promotion Discount';
  const isNarrow = width <= 384;
  const qrSize = claimQrUrl
    ? (isNarrow ? 146 : 166)
    : (isNarrow ? 128 : 144);
  const gstAmount = order.tax > 0 ? order.tax : Number((order.total / 11).toFixed(2));
  const subtotalExGst = Number((order.total - gstAmount).toFixed(2));

  return (
    <View style={[styles.container, { width }]}>
      <View style={styles.header}>
        <Text style={styles.dateText}>{new Date(order.created_at).toLocaleString()}</Text>
        <Text style={styles.storeName}>{storeName}</Text>
        {addressLines.map((line) => (
          <Text key={line} style={styles.addressText}>{line}</Text>
        ))}
        <Text style={styles.orderNumberText}>
          P{order.order_number?.split('-').pop()?.replace(/\D+/g, '')}
        </Text>
        <Text style={styles.metaText}>
          {getOrderChannelReceiptLabel(order)}
        </Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Items</Text>
        <Text style={styles.sectionTitle}>{getOrderLineItemCount(order)}</Text>
      </View>

      {(order.items || []).map((item, index) => {
        const isFreeItem = isFreePromotionOrderItem(order, item.product_name);

        return (
        <View key={`${item.product_id || item.product_name}-${index}`} style={styles.itemBlock}>
          <View style={styles.itemRow}>
            <Text style={styles.itemName}>
              {item.quantity}x {item.product_name}
            </Text>
            <View style={styles.itemPriceBlock}>
              {isFreeItem ? (
                <>
                  <Text style={styles.itemPriceFree}>FREE</Text>
                  <Text style={styles.itemPriceOriginal}>${formatMoney(item.subtotal)}</Text>
                </>
              ) : (
                <Text style={styles.itemPrice}>${formatMoney(item.subtotal)}</Text>
              )}
            </View>
          </View>
          {groupAddons(item.addons || []).map((addon, addonIndex) => (
            <Text key={`${item.product_name}-addon-${addonIndex}`} style={styles.modifierText}>
              {addon.quantity > 1 ? `${addon.quantity}x ` : '+ '}
              {addon.name}
              {addon.price > 0 ? ` ($${formatMoney(addon.price)})` : ''}
            </Text>
          ))}
          {item.removed_ingredients?.map((ingredient, removedIndex) => (
            <Text key={`${item.product_name}-removed-${removedIndex}`} style={styles.modifierText}>
              No {ingredient}
            </Text>
          ))}
          {item.comment?.trim() ? (
            <Text style={styles.modifierText}>Note: {item.comment.trim()}</Text>
          ) : null}
        </View>
      )})}

      {orderNotes ? (
        <>
          <View style={styles.divider} />
          <Text style={styles.notesTitle}>Notes</Text>
          <Text style={styles.notesText}>{orderNotes}</Text>
        </>
      ) : null}

      <View style={styles.divider} />

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Subtotal (ex GST)</Text>
        <Text style={styles.totalValue}>${formatMoney(subtotalExGst)}</Text>
      </View>
      {gstAmount > 0 ? (
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>GST (incl.)</Text>
          <Text style={styles.totalValue}>${formatMoney(gstAmount)}</Text>
        </View>
      ) : null}
      {order.delivery_fee > 0 ? (
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Delivery</Text>
          <Text style={styles.totalValue}>${formatMoney(order.delivery_fee)}</Text>
        </View>
      ) : null}
      {order.service_fee > 0 ? (
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Service Fee</Text>
          <Text style={styles.totalValue}>${formatMoney(order.service_fee)}</Text>
        </View>
      ) : null}
      {order.promotion_discount > 0 ? (
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>{promotionLabel}</Text>
          <Text style={styles.totalValue}>-${formatMoney(order.promotion_discount)}</Text>
        </View>
      ) : null}
      {order.coupon_discount > 0 ? (
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>
            {order.coupon_code ? `Coupon (${order.coupon_code})` : 'Coupon Discount'}
          </Text>
          <Text style={styles.totalValue}>-${formatMoney(order.coupon_discount)}</Text>
        </View>
      ) : null}
      {rewardPointsUsed > 0 && rewardPointsValue > 0 ? (
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Points ({rewardPointsUsed.toLocaleString()})</Text>
          <Text style={styles.totalValue}>-${formatMoney(rewardPointsValue)}</Text>
        </View>
      ) : null}
      {rewardPointsBalance > 0 ? (
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Points Balance</Text>
          <Text style={styles.totalValue}>{rewardPointsBalance.toLocaleString()}</Text>
        </View>
      ) : null}

      <View style={[styles.totalRow, styles.totalRowFinal]}>
        <Text style={styles.grandTotalLabel}>TOTAL</Text>
        <Text style={styles.grandTotalValue}>${formatMoney(order.total)}</Text>
      </View>
      <Text style={styles.paymentStatus}>
        {order.payment_status?.toUpperCase() === 'PAID' ? 'PAID' : 'UNPAID'}
      </Text>

      <View style={styles.qrSection}>
        <View style={styles.qrColumn}>
          <Text style={styles.qrIntro}>Online with us</Text>
          <ReceiptQrCode value={qrLandingUrl} size={qrSize} />
          <Text style={styles.websiteText}>{qrLandingUrl}</Text>
        </View>
        {claimQrUrl ? (
          <View style={styles.qrColumn}>
            <Text style={styles.qrIntro}>Claim rewards</Text>
            <ReceiptQrCode value={claimQrUrl} size={qrSize} />
            <Text style={styles.websiteText}>Scan to link this order</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.footerSection}>
        <Text style={styles.footerText}>Thank you for your order.</Text>
        <Text style={styles.footerText}>We appreciate your support and hope to see you again soon.</Text>
        <Text style={styles.footerText}>To re-order by phone: {storePhone}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  header: {
    alignItems: 'center',
    gap: 4,
  },
  dateText: {
    fontSize: 22,
    color: '#000',
    textAlign: 'center',
  },
  storeName: {
    fontSize: 28,
    fontWeight: '800',
    color: '#000',
    textAlign: 'center',
  },
  addressText: {
    fontSize: 18,
    color: '#000',
    textAlign: 'center',
  },
  metaText: {
    fontSize: 18,
    color: '#000',
    textAlign: 'center',
    marginTop: 2,
  },
  orderNumberText: {
    fontSize: 42,
    fontWeight: '900',
    color: '#000',
    textAlign: 'center',
    marginTop: 6,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    borderStyle: 'dashed',
    marginVertical: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000',
  },
  itemBlock: {
    marginBottom: 8,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  itemPriceBlock: {
    alignItems: 'flex-end',
  },
  itemName: {
    flex: 1,
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
  },
  itemPrice: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
  },
  itemPriceFree: {
    fontSize: 24,
    fontWeight: '700',
    color: '#059669',
  },
  itemPriceOriginal: {
    fontSize: 16,
    color: '#6b7280',
    textDecorationLine: 'line-through',
  },
  modifierText: {
    fontSize: 18,
    color: '#000',
    paddingLeft: 12,
    marginTop: 2,
  },
  notesTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4,
  },
  notesText: {
    fontSize: 18,
    color: '#000',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  totalLabel: {
    fontSize: 20,
    color: '#000',
  },
  totalValue: {
    fontSize: 20,
    color: '#000',
  },
  totalRowFinal: {
    marginTop: 6,
  },
  grandTotalLabel: {
    fontSize: 28,
    fontWeight: '800',
    color: '#000',
  },
  grandTotalValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#000',
  },
  paymentStatus: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
    textAlign: 'right',
    marginTop: 2,
  },
  qrSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    flexWrap: 'nowrap',
    marginTop: 16,
    gap: 12,
  },
  qrColumn: {
    alignItems: 'center',
    flex: 1,
    maxWidth: '48%',
  },
  qrIntro: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
    marginBottom: 8,
  },
  websiteText: {
    fontSize: 16,
    color: '#000',
    textAlign: 'center',
    marginTop: 8,
  },
  footerSection: {
    alignItems: 'center',
    marginTop: 14,
    gap: 2,
  },
  footerText: {
    fontSize: 18,
    color: '#000',
    textAlign: 'center',
  },
});
