import React from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity } from 'react-native';
import { Button as PaperButton } from 'react-native-paper';
import type { Order } from '@my-small-business/types';
import { getFriendlyOrderNumber } from '../utils/orderNumber';
import { STATUS_COLORS, STATUS_LABELS, PAYMENT_STATUS_LABELS } from '../utils/constants';

interface OrderDetailModalProps {
  visible: boolean;
  order: Order | null;
  onClose: () => void;
  onPrint: (order: Order) => void;
}

export const OrderDetailModal: React.FC<OrderDetailModalProps> = ({
  visible,
  order,
  onClose,
  onPrint,
}) => {
  if (!order) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>
            Order {getFriendlyOrderNumber(order.order_number)}
          </Text>
          <View style={styles.modalHeaderActions}>
            <TouchableOpacity
              style={styles.modalActionButton}
              onPress={() => onPrint(order)}
            >
              <Text style={styles.modalActionButtonText}>Print</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={onClose}
            >
              <Text style={styles.modalCloseButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
        <ScrollView style={styles.modalContent}>
          <View style={styles.modalSection}>
            <Text style={styles.modalSectionTitle}>Customer Information</Text>
            <Text style={styles.modalText}>{order.customer_name || 'N/A'}</Text>
            <Text style={styles.modalTextSecondary}>{order.customer_email}</Text>
            <Text style={styles.modalTextSecondary}>{order.customer_phone}</Text>
          </View>

          <View style={styles.modalSection}>
            <Text style={styles.modalSectionTitle}>Order Details</Text>
            <View style={styles.modalInfoRow}>
              <Text style={styles.modalInfoLabel}>Payment:</Text>
              <Text style={styles.modalInfoValue}>
                {order.payment_method} - {PAYMENT_STATUS_LABELS[order.payment_status]}
              </Text>
            </View>
            <View style={styles.modalInfoRow}>
              <Text style={styles.modalInfoLabel}>Status:</Text>
              <View style={[styles.modalStatusBadge, { backgroundColor: STATUS_COLORS[order.order_status] }]}>
                <Text style={styles.modalStatusText}>
                  {STATUS_LABELS[order.order_status]}
                </Text>
              </View>
            </View>
            <Text style={styles.modalTextSecondary}>
              {new Date(order.created_at).toLocaleString()}
            </Text>
          </View>

          {order.special_instructions && (
            <View style={styles.modalSection}>
              <Text style={styles.modalSectionTitle}>Special Instructions</Text>
              <Text style={styles.modalText}>{order.special_instructions}</Text>
            </View>
          )}

          {order.items && order.items.length > 0 && (
            <View style={styles.modalSection}>
              <Text style={styles.modalSectionTitle}>Order Items</Text>
              {order.items.map((item, index) => (
                <View key={index} style={styles.modalItemCard}>
                  <Text style={styles.modalItemName}>
                    {item.quantity}x {item.product_name}
                  </Text>
                  <Text style={styles.modalItemPrice}>${item.subtotal.toFixed(2)}</Text>
                  {item.comment && (
                    <Text style={styles.modalItemComment}>Note: {item.comment}</Text>
                  )}
                  {Array.isArray(item.removed_ingredients) && item.removed_ingredients.length > 0 && (
                    <Text style={styles.modalRemovedText}>
                      Removed: {item.removed_ingredients.join(', ')}
                    </Text>
                  )}
                  {item.addons && item.addons.length > 0 && (
                    <View style={styles.modalAddonsContainer}>
                      {Object.values(
                        item.addons.reduce((acc, addon) => {
                          const key = `${addon.addon_item_name}__${addon.addon_item_price}`;
                          if (!acc[key]) acc[key] = { ...addon, qty: 0 };
                          acc[key].qty += 1;
                          return acc;
                        }, {} as Record<string, any>)
                      ).map((groupedAddon: any) => {
                        const qty = groupedAddon.qty;
                        const name = groupedAddon.addon_item_name;
                        const price = groupedAddon.addon_item_price;
                        let label = qty > 1 ? `${qty}x ${name}` : name;
                        const isPaid = price > 0;
                        if (isPaid) label += ` - $${price.toFixed(2)}`;
                        return (
                          <Text
                            key={groupedAddon.addon_item_id + '_' + price}
                            style={[styles.modalAddonText, isPaid && { fontWeight: 'bold' }]}
                          >
                            + {label}
                          </Text>
                        );
                      })}
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}

          <View style={styles.modalSection}>
            <Text style={styles.modalSectionTitle}>Total</Text>
            <View style={styles.modalTotalRow}>
              <Text style={styles.modalTotalLabel}>Subtotal:</Text>
              <Text style={styles.modalTotalValue}>${order.subtotal.toFixed(2)}</Text>
            </View>
            {order.tax > 0 && (
              <View style={styles.modalTotalRow}>
                <Text style={styles.modalTotalLabel}>Tax:</Text>
                <Text style={styles.modalTotalValue}>${order.tax.toFixed(2)}</Text>
              </View>
            )}
            {order.delivery_fee > 0 && (
              <View style={styles.modalTotalRow}>
                <Text style={styles.modalTotalLabel}>Delivery Fee:</Text>
                <Text style={styles.modalTotalValue}>${order.delivery_fee.toFixed(2)}</Text>
              </View>
            )}
            {order.service_fee > 0 && (
              <View style={styles.modalTotalRow}>
                <Text style={styles.modalTotalLabel}>Service Fee:</Text>
                <Text style={styles.modalTotalValue}>${order.service_fee.toFixed(2)}</Text>
              </View>
            )}
            <View style={[styles.modalTotalRow, styles.modalFinalTotal]}>
              <Text style={styles.modalFinalTotalLabel}>Total:</Text>
              <Text style={styles.modalFinalTotalValue}>${order.total.toFixed(2)}</Text>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#f9fafb',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  modalHeaderActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalActionButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#2563eb',
    borderRadius: 6,
  },
  modalActionButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  modalCloseButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 6,
  },
  modalCloseButtonText: {
    color: '#374151',
    fontWeight: '600',
  },
  modalContent: {
    padding: 16,
  },
  modalSection: {
    marginBottom: 24,
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalText: {
    fontSize: 16,
    color: '#111827',
    marginBottom: 4,
  },
  modalTextSecondary: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 2,
  },
  modalInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalInfoLabel: {
    fontSize: 15,
    color: '#6b7280',
    width: 100,
  },
  modalInfoValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  modalStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  modalStatusText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  modalItemCard: {
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  modalItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  modalItemPrice: {
    fontSize: 15,
    color: '#6b7280',
    marginBottom: 8,
  },
  modalItemComment: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#d97706',
    marginTop: 4,
  },
  modalRemovedText: {
    fontSize: 14,
    color: '#dc2626',
    marginTop: 4,
  },
  modalAddonsContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  modalAddonText: {
    fontSize: 14,
    color: '#4b5563',
    marginBottom: 2,
  },
  modalTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  modalTotalLabel: {
    fontSize: 15,
    color: '#6b7280',
  },
  modalTotalValue: {
    fontSize: 15,
    color: '#111827',
  },
  modalFinalTotal: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 2,
    borderTopColor: '#f3f4f6',
  },
  modalFinalTotalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  modalFinalTotalValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2563eb',
  },
});
