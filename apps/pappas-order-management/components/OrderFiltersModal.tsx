import React from 'react';
import { View, Text, StyleSheet, Modal, ScrollView } from 'react-native';
import { Chip, Button as PaperButton } from 'react-native-paper';
import { STATUS_LABELS, PAYMENT_STATUS_LABELS } from '../utils/constants';

interface OrderFiltersModalProps {
  visible: boolean;
  statusFilter: string;
  paymentFilter: string;
  onStatusChange: (status: string) => void;
  onPaymentChange: (payment: string) => void;
  onApply: () => void;
  onReset: () => void;
  onClose: () => void;
  hideStatusFilter?: boolean;
}

export const OrderFiltersModal: React.FC<OrderFiltersModalProps> = ({
  visible,
  statusFilter,
  paymentFilter,
  onStatusChange,
  onPaymentChange,
  onApply,
  onReset,
  onClose,
  hideStatusFilter = false,
}) => {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.filtersModalBackdrop}>
        <View style={styles.filtersModalContent}>
          <Text style={styles.filtersModalTitle}>Filters</Text>
          <ScrollView style={styles.filtersModalScroll} contentContainerStyle={styles.filtersModalScrollContent}>
            {!hideStatusFilter && (
              <View style={styles.filterGroup}>
                <Text style={styles.filterLabel}>Status</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
                  <Chip selected={statusFilter === 'all'} onPress={() => onStatusChange('all')} style={styles.chip}>
                    All
                  </Chip>
                  {Object.entries(STATUS_LABELS).map(([status, label]) => (
                    <Chip
                      key={status}
                      selected={statusFilter === status}
                      onPress={() => onStatusChange(status)}
                      style={styles.chip}
                    >
                      {label}
                    </Chip>
                  ))}
                </ScrollView>
              </View>
            )}
            <View style={styles.filterGroup}>
              <Text style={styles.filterLabel}>Payment</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
                <Chip selected={paymentFilter === 'all'} onPress={() => onPaymentChange('all')} style={styles.chip}>
                  All
                </Chip>
                {Object.entries(PAYMENT_STATUS_LABELS).map(([status, label]) => (
                  <Chip
                    key={status}
                    selected={paymentFilter === status}
                    onPress={() => onPaymentChange(status)}
                    style={styles.chip}
                  >
                    {label}
                  </Chip>
                ))}
              </ScrollView>
            </View>
          </ScrollView>
          <View style={styles.filtersModalActions}>
            <PaperButton
              mode="outlined"
              onPress={onReset}
              style={styles.resetButton}
            >
              Reset
            </PaperButton>
            <PaperButton
              mode="contained"
              onPress={onApply}
              style={styles.applyButton}
            >
              Apply
            </PaperButton>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  filtersModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  filtersModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    maxHeight: '80%',
  },
  filtersModalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 24,
  },
  filtersModalScroll: {
    marginBottom: 24,
  },
  filtersModalScrollContent: {
    gap: 20,
  },
  filterGroup: {
    marginBottom: 16,
  },
  filterLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  filterScroll: {
    flexDirection: 'row',
  },
  chip: {
    marginRight: 8,
    backgroundColor: '#f3f4f6',
  },
  filtersModalActions: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  resetButton: {
    flex: 1,
    borderRadius: 8,
  },
  applyButton: {
    flex: 1,
    borderRadius: 8,
    backgroundColor: '#2563eb',
  },
});
