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
  const orderDate = new Date(order.created_at);
  const shortOrderNumber = `P${order.order_number?.split('-').pop()?.replace(/\D+/g, '') || order.id.slice(0, 6).toUpperCase()}`;
  const paymentLabel = order.payment_status?.toUpperCase() === 'PAID' ? 'Paid' : 'Payment Pending';
  const hasClaimQr = !!claimQrUrl;

  return (
    <View style={[styles.container, { width }]}>
      <View style={styles.heroBand}>
        <Text style={styles.heroEyebrow}>Customer Receipt</Text>
        <Text style={styles.storeName}>{storeName}</Text>
        <View style={styles.contactBlock}>
          {addressLines.map((line) => (
            <Text key={line} style={styles.addressText}>{line}</Text>
          ))}
          <Text style={styles.contactText}>{storePhone}</Text>
          <Text style={styles.contactText}>{siteUrl.replace(/^https?:\/\//, '')}</Text>
        </View>
      </View>

      <View style={styles.headerCard}>
        <View style={styles.headerRow}>
          <View style={styles.headerMetaBlock}>
            <Text style={styles.headerLabel}>Order</Text>
            <Text style={styles.orderNumberText}>{shortOrderNumber}</Text>
          </View>
          <View style={styles.statusPill}>
            <Text style={styles.statusPillText}>{paymentLabel}</Text>
          </View>
        </View>
        <View style={styles.infoGrid}>
          <View style={styles.infoCell}>
            <Text style={styles.infoLabel}>Date</Text>
            <Text style={styles.infoValue}>{orderDate.toLocaleDateString()}</Text>
          </View>
          <View style={styles.infoCell}>
            <Text style={styles.infoLabel}>Time</Text>
            <Text style={styles.infoValue}>{orderDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</Text>
          </View>
          <View style={styles.infoCell}>
            <Text style={styles.infoLabel}>Order Type</Text>
            <Text style={styles.infoValue}>{getOrderChannelReceiptLabel(order)}</Text>
          </View>
          <View style={styles.infoCell}>
            <Text style={styles.infoLabel}>Guest</Text>
            <Text style={styles.infoValue}>{order.customer_name?.trim() || 'Valued Customer'}</Text>
          </View>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Order Items</Text>
        <Text style={styles.sectionCount}>{getOrderLineItemCount(order)}</Text>
      </View>

      {(order.items || []).map((item, index) => {
        const isFreeItem = isFreePromotionOrderItem(order, item.product_name);

        return (
        <View key={`${item.product_id || item.product_name}-${index}`} style={styles.itemCard}>
          <View style={styles.itemRow}>
            <View style={styles.itemNameBlock}>
              <Text style={styles.itemQty}>{item.quantity}x</Text>
              <Text style={styles.itemName}>{item.product_name}</Text>
            </View>
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
          <View style={styles.notePanel}>
            <Text style={styles.notesTitle}>Order Notes</Text>
            <Text style={styles.notesText}>{orderNotes}</Text>
          </View>
        </>
      ) : null}

      <View style={styles.totalsCard}>
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
            <Text style={[styles.totalValue, styles.discountValue]}>-${formatMoney(order.promotion_discount)}</Text>
          </View>
        ) : null}
        {order.coupon_discount > 0 ? (
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>
              {order.coupon_code ? `Coupon (${order.coupon_code})` : 'Coupon Discount'}
            </Text>
            <Text style={[styles.totalValue, styles.discountValue]}>-${formatMoney(order.coupon_discount)}</Text>
          </View>
        ) : null}
        {rewardPointsUsed > 0 && rewardPointsValue > 0 ? (
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Points ({rewardPointsUsed.toLocaleString()})</Text>
            <Text style={[styles.totalValue, styles.discountValue]}>-${formatMoney(rewardPointsValue)}</Text>
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
        <Text style={styles.paymentStatus}>{paymentLabel}</Text>
      </View>

      <View style={[styles.qrSection, !hasClaimQr ? styles.qrSectionSingle : null]}>
        <View style={styles.qrColumn}>
          <Text style={styles.qrIntro}>Order Online</Text>
          <ReceiptQrCode value={qrLandingUrl} size={qrSize} />
          <Text style={styles.websiteText}>Scan for menu and online ordering</Text>
        </View>
        {claimQrUrl ? (
          <View style={styles.qrColumn}>
            <Text style={styles.qrIntro}>Claim Rewards</Text>
            <ReceiptQrCode value={claimQrUrl} size={qrSize} />
            <Text style={styles.websiteText}>Scan to link this order</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.footerSection}>
        <Text style={styles.footerHeadline}>Thank you for your order</Text>
        <Text style={styles.footerText}>Prepared fresh with care by {storeName}.</Text>
        <Text style={styles.footerText}>Receipt issued on {orderDate.toLocaleString()}.</Text>
        <Text style={styles.footerText}>To place your next order, call {storePhone}.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 18,
  },
  heroBand: {
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#111',
  },
  heroEyebrow: {
    fontSize: 14,
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontWeight: '700',
    color: '#44403c',
    marginBottom: 4,
  },
  contactBlock: {
    alignItems: 'center',
    marginTop: 6,
  },
  headerCard: {
    paddingTop: 12,
    paddingBottom: 10,
  },
  storeName: {
    fontSize: 30,
    fontWeight: '800',
    color: '#000',
    textAlign: 'center',
  },
  addressText: {
    fontSize: 16,
    color: '#000',
    textAlign: 'center',
  },
  contactText: {
    fontSize: 15,
    color: '#000',
    textAlign: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  headerMetaBlock: {
    flex: 1,
  },
  headerLabel: {
    fontSize: 13,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontWeight: '700',
    color: '#57534e',
  },
  orderNumberText: {
    fontSize: 30,
    fontWeight: '900',
    color: '#000',
    marginTop: 4,
  },
  statusPill: {
    borderWidth: 1.5,
    borderColor: '#111',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#fff',
  },
  statusPillText: {
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    color: '#111',
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#d6d3d1',
    paddingTop: 10,
    gap: 8,
  },
  infoCell: {
    width: '48%',
  },
  infoLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: '700',
    color: '#78716c',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: '#57534e',
    borderStyle: 'dashed',
    marginVertical: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000',
  },
  sectionCount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#44403c',
  },
  itemCard: {
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e7e5e4',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  itemNameBlock: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  itemQty: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111',
    minWidth: 30,
  },
  itemPriceBlock: {
    alignItems: 'flex-end',
  },
  itemName: {
    flex: 1,
    fontSize: 21,
    fontWeight: '700',
    color: '#000',
  },
  itemPrice: {
    fontSize: 21,
    fontWeight: '700',
    color: '#000',
  },
  itemPriceFree: {
    fontSize: 21,
    fontWeight: '700',
    color: '#059669',
  },
  itemPriceOriginal: {
    fontSize: 16,
    color: '#6b7280',
    textDecorationLine: 'line-through',
  },
  modifierText: {
    fontSize: 15,
    color: '#44403c',
    paddingLeft: 38,
    marginTop: 4,
    lineHeight: 20,
  },
  notePanel: {
    marginTop: 8,
    paddingTop: 4,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: '#d6d3d1',
  },
  notesTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4,
  },
  notesText: {
    fontSize: 16,
    color: '#000',
    lineHeight: 22,
  },
  totalsCard: {
    marginTop: 6,
    paddingTop: 12,
    paddingBottom: 4,
    borderTopWidth: 2,
    borderTopColor: '#111',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  totalLabel: {
    fontSize: 17,
    color: '#000',
  },
  totalValue: {
    fontSize: 17,
    color: '#000',
    fontWeight: '600',
  },
  discountValue: {
    color: '#047857',
  },
  totalRowFinal: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#111',
  },
  grandTotalLabel: {
    fontSize: 26,
    fontWeight: '800',
    color: '#000',
  },
  grandTotalValue: {
    fontSize: 26,
    fontWeight: '800',
    color: '#000',
  },
  paymentStatus: {
    fontSize: 14,
    fontWeight: '700',
    color: '#44403c',
    textAlign: 'right',
    marginTop: 6,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  qrSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    flexWrap: 'nowrap',
    marginTop: 18,
    gap: 12,
  },
  qrSectionSingle: {
    justifyContent: 'center',
  },
  qrColumn: {
    alignItems: 'center',
    flex: 1,
    maxWidth: '48%',
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderTopWidth: 1,
    borderTopColor: '#d6d3d1',
  },
  qrIntro: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
    marginBottom: 8,
  },
  websiteText: {
    fontSize: 14,
    color: '#44403c',
    textAlign: 'center',
    marginTop: 8,
  },
  footerSection: {
    alignItems: 'center',
    marginTop: 16,
    borderTopWidth: 2,
    borderTopColor: '#111',
    paddingTop: 14,
  },
  footerHeadline: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111',
    textAlign: 'center',
    marginBottom: 4,
  },
  footerText: {
    fontSize: 15,
    color: '#44403c',
    textAlign: 'center',
    lineHeight: 21,
    marginTop: 2,
  },
});
