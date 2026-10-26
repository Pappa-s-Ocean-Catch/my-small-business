import { ActionButton as Button } from '@/components/ui/ActionButton';
import { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import type { Order } from '@my-small-business/types';
import { findCustomerByPhone, createCustomerIfNotExists, type Customer } from '../lib/customers';
import { associateCustomerWithOrder, createPayByLink } from '../lib/pay-by-link';
import { ReceiptQrCode } from './ReceiptQrCode';
import { EditorSheet, FormField, designTokens as t } from '@/components/ui';

type Props = {
  visible: boolean;
  order: Order | null;
  onDismiss: () => void;
  onOrderRefresh: (order: Order) => void;
};

export function PayByLinkModal({ visible, order, onDismiss, onOrderRefresh }: Props) {
  const sendInProgress = useRef(false);
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lookingUpCustomer, setLookingUpCustomer] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setPhone(order?.customer_phone || '');
    setName(order?.customer_name || '');
    setCustomer(null);
    setPaymentUrl(null);
    setLookingUpCustomer(false);
    setLookupError(null);
  }, [visible, order?.id]);

  useEffect(() => {
    if (!visible || paymentUrl) return;
    const digits = phone.replace(/\D/g, '');
    const isValidPhone = (digits.length === 10 && (digits.startsWith('04') || digits.startsWith('03')))
      || (digits.length === 11 && (digits.startsWith('614') || digits.startsWith('613')));
    if (!isValidPhone) {
      setCustomer(null);
      setLookingUpCustomer(false);
      setLookupError(null);
      return;
    }

    setCustomer(null);
    let active = true;
    const timer = setTimeout(() => {
      setLookingUpCustomer(true);
      setLookupError(null);
      void findCustomerByPhone(phone.trim()).then((result) => {
        if (!active) return;
        if (result.error) {
          setCustomer(null);
          setLookupError(result.error);
          return;
        }
        setCustomer(result.data);
        if (result.data?.name) setName(result.data.name);
      }).catch((error) => {
        if (active) setLookupError(error instanceof Error ? error.message : 'Failed to look up customer.');
      }).finally(() => {
        if (active) setLookingUpCustomer(false);
      });
    }, 350);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [phone, visible, paymentUrl]);

  const handleSend = async () => {
    if (!order || sendInProgress.current) return;
    const normalizedPhone = phone.trim();
    if (!normalizedPhone) return Alert.alert('Customer phone', 'Enter the customer phone number first.');
    sendInProgress.current = true;
    setLoading(true);
    try {
      const lookup = await findCustomerByPhone(normalizedPhone);
      if (lookup.error) throw new Error(lookup.error);
      const resolvedCustomer = lookup.data;
      if (!resolvedCustomer && !name.trim()) {
        throw new Error('Enter the customer name to create their customer record.');
      }
      const created = resolvedCustomer ? null : await createCustomerIfNotExists(normalizedPhone, name.trim());
      if (created?.error) throw new Error(created.error);
      const finalCustomer = resolvedCustomer || created?.data;
      if (!finalCustomer) throw new Error('Customer could not be created.');
      setCustomer(finalCustomer);
      const association = await associateCustomerWithOrder(order.id, finalCustomer);
      if (association.error || !association.data) throw new Error(association.error || 'Failed to update this order.');
      onOrderRefresh(association.data);
      const link = await createPayByLink(order.id);
      setPhone(finalCustomer.phone || normalizedPhone);
      setPaymentUrl(link.paymentUrl);
    } catch (error) {
      Alert.alert('Pay by Link', error instanceof Error ? error.message : 'Failed to create payment link.');
    } finally {
      sendInProgress.current = false;
      setLoading(false);
    }
  };

  return (
    <EditorSheet
      visible={visible}
      title={paymentUrl ? 'Payment link sent' : 'Pay by Link'}
      onDismiss={onDismiss}
      pending={loading}
      footer={paymentUrl ? (
        <Button mode="contained" onPress={onDismiss} style={styles.action} contentStyle={styles.actionContent}>Done</Button>
      ) : <>
        <Button mode="outlined" onPress={onDismiss} disabled={loading} style={styles.action} contentStyle={styles.actionContent}>Cancel</Button>
        <Button mode="contained" onPress={() => void handleSend()} loading={loading} disabled={loading || !order || !phone.trim() || lookingUpCustomer} style={styles.action} contentStyle={styles.actionContent}>Send link</Button>
      </>}
    >
      <View style={styles.summary}>
        <Text style={styles.summaryLabel}>Amount due</Text>
        <Text style={styles.amount}>${order?.total.toFixed(2) ?? '0.00'}</Text>
      </View>
      {paymentUrl ? <>
        <View style={styles.success} accessibilityLiveRegion="polite">
          <Text style={styles.successTitle}>SMS sent to {phone}</Text>
          <Text style={styles.copy}>The customer can open the link or scan this code to pay.</Text>
        </View>
        <View style={styles.qr} accessible accessibilityLabel="Payment QR code"><ReceiptQrCode value={paymentUrl} size={220} /></View>
        <Text style={styles.copy}>Payment remains unpaid until the customer completes payment.</Text>
      </> : <>
        <Text style={styles.copy}>Send the customer a secure payment link by SMS.</Text>
        <FormField label="Phone number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" disabled={loading} />
        {lookingUpCustomer ? <Text style={styles.copy} accessibilityLiveRegion="polite">Looking up customer…</Text> : null}
        {customer ? <View style={styles.success}><Text style={styles.customerFound}>Existing customer: {customer.name || customer.phone}</Text></View> : null}
        {lookupError ? <Text style={styles.error} accessibilityRole="alert">{lookupError}</Text> : null}
        {!customer ? <>
          <FormField label="Customer name" value={name} onChangeText={setName} autoCapitalize="words" autoComplete="name" disabled={loading} />
          <Text style={styles.copy}>A name is required to create a new customer record.</Text>
        </> : null}
      </>}
    </EditorSheet>
  );
}

const styles = StyleSheet.create({
  summary: { backgroundColor: t.color.navy, borderRadius: t.radius.card, padding: 20, gap: 8 },
  summaryLabel: { color: t.color.surface, fontSize: 16 },
  amount: { fontSize: 32, fontWeight: '700', color: t.color.surface, fontVariant: ['tabular-nums'] },
  copy: { fontSize: 15, color: t.color.muted, lineHeight: 22 },
  success: { borderRadius: t.radius.control, padding: 14, gap: 6, backgroundColor: t.color.successTint },
  successTitle: { fontSize: 17, fontWeight: '700', color: t.color.success },
  customerFound: { fontSize: 15, fontWeight: '700', color: t.color.success },
  error: { fontSize: 14, lineHeight: 21, color: t.color.danger },
  qr: { alignItems: 'center', padding: 12, backgroundColor: t.color.surface },
  action: { borderRadius: t.radius.control },
  actionContent: { minHeight: t.touch.primaryHeight },
});
