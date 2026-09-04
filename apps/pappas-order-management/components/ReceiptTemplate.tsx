import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import type { Order } from '@my-small-business/types';
import {
  buildKitchenReceiptCopies,
  getReceiptHeader,
  getOrderDisplaySubtotal,
  getOrderDisplayTotal,
  getOrderItemDisplaySubtotal,
  getOrderLineItemCount,
  getOrderNotes,
  getOrderOptions,
  groupAddons,
} from '../utils/orderUtils';
import { getDeliveryStatusLabel } from '../utils/constants';
import { getOrderPromotionSummary, isFreePromotionOrderItem } from '../lib/promotion-summary';
import {
  getKitchenPrintDebugFooterLines,
  type KitchenPrintDebugContext,
} from '../lib/print-debug-footer';
import { getOrderPrintIntegrityWarning } from '../lib/order-print-integrity';
import { formatSuccessfulOrderCount } from '../utils/customer-order-count';

interface ReceiptTemplateProps {
  order: Order;
  successfulOrderCount?: number;
  width?: number;
  printSource?: string;
  showTicketCounter?: boolean;
  onlyTicketIndex?: number;
  duplicateBySections?: boolean;
  printDebugContext?: KitchenPrintDebugContext | null;
}

export const ReceiptTemplate: React.FC<ReceiptTemplateProps> = ({
  order,
  successfulOrderCount,
  width = 576,
  printSource,
  showTicketCounter = false,
  onlyTicketIndex,
  duplicateBySections = false,
  printDebugContext,
}) => {
  const formatMoney = (amount: number) => {
    return (amount || 0).toFixed(2);
  };
  const rewardPointsBalance = Number((order as Order & { reward_points_balance?: number | null }).reward_points_balance ?? 0);
  const promotionSummary = getOrderPromotionSummary(order);
  const promotionLabel = promotionSummary?.label || 'Promotion Discount';
  const displaySubtotal = getOrderDisplaySubtotal(order);
  const displayTotal = getOrderDisplayTotal(order);
  const receiptHeader = getReceiptHeader(order);
  const marketplaceLogo = receiptHeader.logo === 'uber_eats'
    ? require('../assets/ubereats-logo.png')
    : receiptHeader.logo === 'doordash'
      ? require('../assets/doordash-logo.png')
      : null;

  const rewardPointsUsed = order.reward_points_used ?? 0;
  const rewardPointsValue = order.reward_points_value ?? 0;
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
  const orderOptions = getOrderOptions(order);
  const orderNotes = getOrderNotes(order);
  const lineItemCount = getOrderLineItemCount(order);
  const deliveryStatusLabel = getDeliveryStatusLabel(order.delivery_status);
  const allTickets = buildKitchenReceiptCopies(order.items || []);
  const combinedSections = allTickets.length > 0
    ? allTickets.flatMap((ticket) => ticket.sections)
    : [{ sectionName: null, items: order.items || [] }];
  const combinedTicket = {
    key: 'combined',
    copyNumber: 1,
    totalCopies: 1,
    sections: combinedSections,
  };
  const tickets = duplicateBySections
    ? (
      onlyTicketIndex == null
        ? allTickets
        : allTickets[onlyTicketIndex]
          ? [allTickets[onlyTicketIndex]]
          : allTickets
    )
    : [combinedTicket];
  const printDebugLines = getKitchenPrintDebugFooterLines(printDebugContext);
  const integrityWarning = getOrderPrintIntegrityWarning(order);

  return (
    <View>
      {tickets.map((ticket, ticketIdx) => (
        <View
          key={ticket.key}
          style={[styles.container, { width }, ticketIdx > 0 ? styles.ticketSpacing : null]}
        >
          <View style={styles.receiptHeader}>
            {marketplaceLogo && (
              <Image source={marketplaceLogo} style={styles.marketplaceLogo} resizeMode="contain" />
            )}
            <Text style={styles.receiptHeaderLabel}>{receiptHeader.label}</Text>
          </View>

          {showTicketCounter && tickets.length > 1 && (
            <View style={styles.ticketCounterRow}>
              <Text style={styles.ticketCounterText}>{ticket.copyNumber}/{ticket.totalCopies}</Text>
            </View>
          )}

          {pickupDisplay && (
            <View style={styles.preOrderContainer}>
              <Text style={styles.preOrderLabel}>*** PRE-ORDER ***</Text>
              <Text style={styles.preOrderTime}>PICKUP: {pickupDisplay}</Text>
            </View>
          )}

          <Text style={styles.headerText}>{createdDate}</Text>
          <Text style={styles.headerText}>{order.payment_method?.toUpperCase()}</Text>

          <View style={styles.divider} />

          <View style={styles.section}>
            <View style={styles.customerSection}>
              <Text style={styles.customerLargeBoldText}>{order.customer_name || order.customer_email}</Text>
              {order.customer_phone && <Text style={styles.customerLargeBoldText}>{order.customer_phone}</Text>}
              {successfulOrderCount != null && (
                <Text style={styles.customerNormalText}>Customer orders: {formatSuccessfulOrderCount(successfulOrderCount)}</Text>
              )}
              {order.order_type === 'delivery' && order.delivery_address_line1 && (
                <View style={styles.deliveryContainer}>
                  <Text style={styles.customerNormalText}>Delivery Address:</Text>
                  <Text style={styles.customerBoldText}>{order.delivery_address_line1}</Text>
                  {order.delivery_address_line2 && <Text style={styles.customerBoldText}>{order.delivery_address_line2}</Text>}
                  <Text style={styles.customerBoldText}>
                    {[order.delivery_city, order.delivery_state, order.delivery_postcode].filter(Boolean).join(' ')}
                  </Text>
                  <Text style={styles.customerNormalText}>Delivery Status: {deliveryStatusLabel}</Text>
                  {order.delivery_driver_name && <Text style={styles.customerNormalText}>Driver: {order.delivery_driver_name}</Text>}
                  {order.delivery_driver_phone && <Text style={styles.customerNormalText}>Driver Phone: {order.delivery_driver_phone}</Text>}
                  {order.delivery_driver_pin && <Text style={styles.customerNormalText}>Driver PIN: {order.delivery_driver_pin}</Text>}
                  {order.delivery_vehicle_info && <Text style={styles.customerNormalText}>Vehicle: {order.delivery_vehicle_info}</Text>}
                  {order.delivery_instructions && <Text style={styles.customerNormalText}>Instructions: {order.delivery_instructions}</Text>}
                </View>
              )}
            </View>
          </View>

          {orderNotes && (
            <View style={styles.noteSection}>
              <Text style={styles.noteTitle}>ORDER NOTES:</Text>
              <Text style={styles.noteText}>{orderNotes}</Text>
            </View>
          )}

          <View style={styles.divider} />

          {orderOptions.map((option, idx) => (
            <View key={`option-${ticketIdx}-${idx}`} style={styles.optionContainer}>
              <Text style={styles.optionText}>* {option}</Text>
            </View>
          ))}
          {ticket.sections.map((section, sectionIdx) => (
            <View key={`${ticket.key}-section-${sectionIdx}`}>
              {section.sectionName && (
                <View style={styles.itemSectionHeader}>
                  <View style={styles.itemSectionLine} />
                  <Text style={styles.itemSectionHeaderText}>{section.sectionName}</Text>
                  <View style={styles.itemSectionLine} />
                </View>
              )}
              {section.items.map((item, idx) => {
                const displaySubtotal = getOrderItemDisplaySubtotal(item);
                return (
                  <View key={`${ticketIdx}-${sectionIdx}-${idx}`} style={styles.itemContainer}>
                    <View style={styles.itemLineRow}>
                      <Text style={styles.itemNameLine} numberOfLines={3}>
                        {item.quantity}x {item.product_name}
                      </Text>
                      {isFreePromotionOrderItem(order, item.product_name) ? (
                        <View style={styles.itemPriceGroup}>
                          <Text style={styles.itemLinePriceFree}>FREE</Text>
                          <Text style={styles.itemLinePriceOriginal}>${formatMoney(displaySubtotal)}</Text>
                        </View>
                      ) : (
                        <Text style={styles.itemLinePrice}>${formatMoney(displaySubtotal)}</Text>
                      )}
                    </View>
                    {item.removed_ingredients?.map((ing, rIdx) => (
                      <Text key={`rm-${ticketIdx}-${sectionIdx}-${rIdx}`} style={styles.removedText}>
                        No {ing}
                      </Text>
                    ))}
                    {groupAddons(item.addons || []).map((addon, aIdx) => (
                      <Text key={`ad-${ticketIdx}-${sectionIdx}-${aIdx}`} style={styles.addonText}>
                        {addon.quantity > 1 ? `${addon.quantity}x ` : '+ '}{addon.name} {addon.price ? `($${formatMoney(addon.price)})` : ''}
                      </Text>
                    ))}
                    {item.comment?.trim() && (
                      <Text style={styles.itemNote}>
                        Notes: {item.comment}
                      </Text>
                    )}
                    {idx < section.items.length - 1 && <View style={styles.itemDivider} />}
                  </View>
                )
              })}
            </View>
          ))}

          <View style={styles.divider} />

          <View style={styles.totalsContainer}>
            <View style={styles.totalRow}>
              <Text style={styles.normalText}>Total items:</Text>
              <Text style={styles.normalText}>{lineItemCount}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.normalText}>Subtotal:</Text>
              <Text style={styles.normalText}>${formatMoney(displaySubtotal)}</Text>
            </View>
            {order.tax > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.normalText}>Tax:</Text>
                <Text style={styles.normalText}>${formatMoney(order.tax)}</Text>
              </View>
            )}
            {order.delivery_fee > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.normalText}>Delivery Fee:</Text>
                <Text style={styles.normalText}>${formatMoney(order.delivery_fee)}</Text>
              </View>
            )}
            {order.promotion_discount > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.normalText}>{promotionLabel}:</Text>
                <Text style={styles.normalText}>-${formatMoney(order.promotion_discount)}</Text>
              </View>
            )}
            {order.coupon_discount > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.normalText}>
                  {order.coupon_code ? `Coupon (${order.coupon_code})` : 'Coupon Discount'}:
                </Text>
                <Text style={styles.normalText}>-${formatMoney(order.coupon_discount)}</Text>
              </View>
            )}
            {rewardPointsUsed > 0 && rewardPointsValue > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.normalText}>Points ({rewardPointsUsed.toLocaleString()}):</Text>
                <Text style={styles.normalText}>-${formatMoney(rewardPointsValue)}</Text>
              </View>
            )}
            {rewardPointsBalance > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.normalText}>Points Balance:</Text>
                <Text style={styles.normalText}>{rewardPointsBalance.toLocaleString()}</Text>
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
                <Text style={styles.largeTotalText}>${formatMoney(displayTotal)}</Text>
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
          {printDebugLines.length > 0 && (
            <View style={styles.printDebugContainer}>
              {printDebugLines.map((line, index) => (
                <Text key={`print-debug-${index}`} style={styles.printDebugText}>{line}</Text>
              ))}
            </View>
          )}
          {integrityWarning && (
            <View style={styles.integrityWarningContainer}>
              <Text style={styles.integrityWarningText}>{integrityWarning}</Text>
            </View>
          )}
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  ticketSpacing: {
    marginTop: 32,
  },
  receiptHeader: {
    alignItems: 'center',
    marginBottom: 8,
  },
  marketplaceLogo: {
    width: 220,
    height: 72,
    marginBottom: 16,
  },
  receiptHeaderLabel: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#000',
    textAlign: 'center',
  },
  ticketCounterRow: {
    alignItems: 'flex-end',
    marginBottom: 4,
  },
  ticketCounterText: {
    fontSize: 18,
    color: '#475569',
    fontWeight: '600',
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
  customerSection: {
    backgroundColor: '#000',
    padding: 12,
    borderRadius: 4,
  },
  customerLargeBoldText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
  },
  customerNormalText: {
    fontSize: 30,
    color: '#fff',
  },
  customerBoldText: {
    fontSize: 30,
    fontWeight: 'bold',
    color: '#fff',
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
  itemDivider: {
    marginTop: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#9ca3af',
    borderStyle: 'dotted',
  },
  optionContainer: {
    marginBottom: 10,
  },
  optionText: {
    fontSize: 40,
    fontWeight: '900',
    color: '#111827',
    lineHeight: 44,
  },
  itemSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    marginTop: 16,
    marginBottom: 16,
  },
  itemSectionLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#000',
  },
  itemSectionHeaderText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#000',
    textAlign: 'center',
  },
  itemLineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  itemPriceGroup: {
    alignItems: 'flex-end',
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
  itemLinePriceFree: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#059669',
    lineHeight: 40,
  },
  itemLinePriceOriginal: {
    fontSize: 18,
    color: '#6b7280',
    textDecorationLine: 'line-through',
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
    fontSize: 30,
    color: '#000',
    fontWeight: 'bold',
    marginLeft: 10,
    lineHeight: 36,
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
  engineText: {
    marginTop: 4,
    fontSize: 14,
    color: '#666',
  },
  printSourceText: {
    marginTop: 4,
    fontSize: 14,
    color: '#444',
  },
  printDebugContainer: {
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#777',
    borderStyle: 'dashed',
  },
  printDebugText: {
    fontSize: 14,
    lineHeight: 18,
    color: '#333',
  },
  integrityWarningContainer: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#000',
  },
  integrityWarningText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
});
