import { useEffect, useState } from 'react';
import { Alert, Modal, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from 'react-native-paper';
import type { Order } from '@my-small-business/types';
import { findCustomerByPhone, createCustomerIfNotExists, type Customer } from '../lib/customers';
import { associateCustomerWithOrder, createPayByLink } from '../lib/pay-by-link';
import { ReceiptQrCode } from './ReceiptQrCode';

type Props = {
  visible: boolean;
  order: Order | null;
  onDismiss: () => void;
  onOrderRefresh: (order: Order) => void;
};

export function PayByLinkModal({ visible, order, onDismiss, onOrderRefresh }: Props) {
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
  }, [phone]);

  const handleSend = async () => {
    if (!order) return;
    const normalizedPhone = phone.trim();
    if (!normalizedPhone) return Alert.alert('Customer phone', 'Enter the customer phone number first.');
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
      setLoading(false);
    }
  };

  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
    <View style={styles.scrim}><View style={styles.card}>
      {paymentUrl ? <>
        <Text style={styles.title}>Payment link sent</Text>
        <View style={styles.qr}><ReceiptQrCode value={paymentUrl} size={250} /></View>
        <Text style={styles.copy}>SMS sent to {phone}</Text>
        <Text style={styles.amount}>${order?.total.toFixed(2)}</Text>
        <Button mode="contained" onPress={onDismiss}>Done</Button>
      </> : <>
        <Text style={styles.title}>Pay by Link</Text>
        <Text style={styles.copy}>We’ll find the customer by phone or create a customer record before sending the Stripe payment link.</Text>
        <TextInput value={phone} onChangeText={setPhone} placeholder="Phone number" keyboardType="phone-pad" style={styles.input} />
        {lookingUpCustomer ? <Text style={styles.copy}>Looking up customer…</Text> : null}
        {customer ? <Text style={styles.customerFound}>Existing customer: {customer.name || customer.phone}</Text> : null}
        {lookupError ? <Text style={styles.error}>{lookupError}</Text> : null}
        {!customer ? <TextInput value={name} onChangeText={setName} placeholder="Name (required for new customer)" style={styles.input} /> : null}
        <View style={styles.actions}><Button onPress={onDismiss}>Cancel</Button><Button mode="contained" onPress={() => void handleSend()} loading={loading} disabled={loading}>Send link</Button></View>
      </>}
    </View></View>
  </Modal>;
}

const styles = StyleSheet.create({
  scrim: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(15,23,42,0.55)', padding: 24 },
  card: { width: '100%', maxWidth: 480, backgroundColor: '#fff', borderRadius: 20, padding: 24, gap: 14 },
  title: { fontSize: 24, fontWeight: '800', color: '#10243f' },
  copy: { fontSize: 15, color: '#475569', lineHeight: 22 },
  amount: { fontSize: 28, fontWeight: '800', color: '#10243f', textAlign: 'center' },
  customerFound: { fontSize: 15, fontWeight: '700', color: '#047857' },
  error: { fontSize: 14, color: '#b91c1c' },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 17 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  qr: { alignItems: 'center', padding: 12, backgroundColor: '#fff' },
});
