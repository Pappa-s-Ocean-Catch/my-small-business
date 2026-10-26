import { ActionButton as Button } from '@/components/ui/ActionButton';
import { EditorSheet } from '@/components/ui';
import { designTokens as t } from '@/lib/redesign';
import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';

import { STATUS_LABELS, PAYMENT_STATUS_LABELS } from '../utils/constants';

interface OrderFiltersModalProps {
  visible: boolean;
  statusFilter: string;
  paymentFilter: string;
  orderMethodFilter: string;
  onStatusChange: (status: string) => void;
  onPaymentChange: (payment: string) => void;
  onOrderMethodChange: (method: string) => void;
  onApply: () => void;
  onReset: () => void;
  onClose: () => void;
  hideStatusFilter?: boolean;
}

function FilterChoices({ label, value, options, onChange }: {
  label: string;
  value: string;
  options: [string, string][];
  onChange: (value: string) => void;
}) {
  return <View style={styles.group}>
    <Text style={styles.label}>{label}</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.choices}>
      {options.map(([key, text]) => <Pressable
        key={key}
        accessibilityRole="radio"
        accessibilityLabel={`${label}: ${text}`}
        accessibilityState={{ checked: value === key }}
        onPress={() => onChange(key)}
        style={[styles.choice, value === key && styles.selectedChoice]}
      ><Text style={[styles.choiceText, value === key && styles.selectedText]}>{text}</Text></Pressable>)}
    </ScrollView>
  </View>;
}

export const OrderFiltersModal: React.FC<OrderFiltersModalProps> = ({
  visible, statusFilter, paymentFilter, orderMethodFilter,
  onStatusChange, onPaymentChange, onOrderMethodChange, onApply, onReset, onClose,
  hideStatusFilter = false,
}) => <EditorSheet
  visible={visible}
  title="Filter order history"
  onDismiss={onClose}
  footer={<>
    <Button mode="text" onPress={onReset} contentStyle={styles.actionContent} style={styles.reset}>Reset</Button>
    <Button mode="outlined" onPress={onClose} contentStyle={styles.actionContent} style={styles.action}>Cancel</Button>
    <Button mode="contained" onPress={onApply} contentStyle={styles.actionContent} style={styles.action}>Apply filters</Button>
  </>}
>
  <View style={styles.body}>
    {!hideStatusFilter && <FilterChoices label="Order status" value={statusFilter} onChange={onStatusChange} options={[
      ['all', 'All'], ...Object.entries(STATUS_LABELS).map(([key, label]): [string, string] => [key, key === 'pending_online_payment' ? 'Waiting for payment' : label]),
    ]} />}
    <FilterChoices label="Payment status" value={paymentFilter} onChange={onPaymentChange} options={[
      ['all', 'All'], ...Object.entries(PAYMENT_STATUS_LABELS),
    ]} />
    <FilterChoices label="Order source" value={orderMethodFilter} onChange={onOrderMethodChange} options={[
      ['all', 'All'], ['online', 'Online'], ['store', 'At counter'],
    ]} />
  </View>
</EditorSheet>;

const styles = StyleSheet.create({
  body: { gap: 24, paddingBottom: 24 },
  group: { gap: 8 },
  label: { fontSize: 14, fontWeight: '700', color: t.color.text },
  choices: { gap: 8 },
  choice: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 16, borderWidth: 1, borderColor: t.color.border, backgroundColor: t.color.surface, borderRadius: t.radius.control },
  selectedChoice: { borderColor: t.color.primary, backgroundColor: t.color.primaryTint },
  choiceText: { color: t.color.text, fontSize: 14, fontWeight: '700' },
  selectedText: { color: t.color.primary },
  actionContent: { minHeight: 48, paddingHorizontal: 8 },
  action: { borderRadius: t.radius.control, borderColor: t.color.border },
  reset: { marginRight: 'auto' },
});
