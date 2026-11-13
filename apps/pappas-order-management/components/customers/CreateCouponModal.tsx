import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { ActivityIndicator, Checkbox, HelperText, Text } from 'react-native-paper';
import { ActionButton as Button } from '@/components/ui/ActionButton';
import { EditorSheet, FormField, SearchField } from '@/components/ui';
import { createCustomerCoupon, type CouponCustomer } from '@/lib/customer-coupon';
import { getRecentCustomers, searchCustomers, type Customer } from '@/lib/customers';
import type { Coupon, PromotionDiscountType } from '@/lib/coupons';

function targetFromCustomer(customer: Customer): CouponCustomer {
  // Summary IDs may be contact-based; only profileId is a valid profile UUID.
  return { profileId: customer.profileId, name: customer.name, email: customer.email, phone: customer.phone };
}

type Props = {
  visible: boolean;
  customer?: CouponCustomer;
  onClose: () => void;
  onCreated: (coupon: Coupon, deliveryMessage?: string) => void;
};

export function CreateCouponModal({ visible, customer: initialCustomer, onClose, onCreated }: Props) {
  const [customer, setCustomer] = useState<CouponCustomer | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Customer[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [discountType, setDiscountType] = useState<PromotionDiscountType>('percent');
  const [discountValue, setDiscountValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [sendEmail, setSendEmail] = useState(false);
  const inFlight = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setCustomer(initialCustomer || null);
    setSendEmail(false);
    setQuery(''); setResults([]); setSearchError(null); setError(null);
    setCode(`GIFT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`);
    setTitle('Customer offer'); setDiscountType('percent'); setDiscountValue('');
  }, [visible, initialCustomer?.profileId, initialCustomer?.email, initialCustomer?.phone]);

  useEffect(() => {
    if (!visible || customer) return;
    let alive = true;
    setSearching(true); setSearchError(null);
    const timer = setTimeout(async () => {
      try {
        const result = query.trim() ? await searchCustomers(query, 0, 10) : await getRecentCustomers(0, 10);
        if (!alive) return;
        setResults(result.data || []); setSearchError(result.error);
      } catch {
        if (alive) { setResults([]); setSearchError('Could not load customers. Please try again.'); }
      } finally { if (alive) setSearching(false); }
    }, 300);
    return () => { alive = false; clearTimeout(timer); };
  }, [visible, customer, query]);

  const submit = async () => {
    if (inFlight.current) return;
    inFlight.current = true; setSaving(true); setError(null);
    try {
      const result = await createCustomerCoupon({ customer, code, title, discountType, discountValue, sendEmail });
      if (result.error || !result.data) { setError(result.error || 'Could not create coupon.'); return; }
      const deliveryMessage = result.emailSent === true ? 'Email sent to the customer.' : result.emailSent === false ? `The coupon was saved, but email was not sent: ${result.emailError || 'Please try again.'} Use Resend coupon email to retry.` : undefined;
      onCreated(result.data, deliveryMessage);
    } finally { inFlight.current = false; setSaving(false); }
  };

  return <EditorSheet visible={visible} title="Create coupon" subtitle="A one-use discount for this customer's order subtotal." onDismiss={onClose} pending={saving} dirty={!!discountValue.trim() || sendEmail} footer={(dismiss) => <>
    <Button mode="outlined" onPress={dismiss} disabled={saving}>Cancel</Button>
    <Button mode="contained" onPress={() => void submit()} loading={saving} disabled={saving || !customer || !discountValue.trim() || !code.trim() || !title.trim()}>Create coupon</Button>
  </>}>
    {error && <Text accessibilityRole="alert" accessibilityLiveRegion="assertive" style={{ color: '#b42318' }}>{error}</Text>}
    <Text variant="titleSmall">Customer</Text>
    {customer ? <View style={{ gap: 6 }}>
      <Text variant="bodyLarge">{customer.name || customer.email || customer.phone || 'Selected customer'}</Text>
      {!!(customer.email || customer.phone) && <Text>{[customer.email, customer.phone].filter(Boolean).join(' · ')}</Text>}
      {!initialCustomer && <Button mode="outlined" onPress={() => { setCustomer(null); setSendEmail(false); setError(null); }}>Change customer</Button>}
    </View> : <View style={{ gap: 8 }}>
      <SearchField placeholder="Search customer name, email or phone" value={query} onChangeText={setQuery} />
      {searching ? <ActivityIndicator accessibilityLabel="Searching customers" /> : searchError ? <Text accessibilityRole="alert">{searchError}</Text> : results.length === 0 ? <Text>No customers found.</Text> : results.map((item, index) => <Button key={`${item.profileId || item.email || item.phone}-${index}`} mode="outlined" onPress={() => setCustomer(targetFromCustomer(item))}>
        {[item.name, item.phone || item.email].filter(Boolean).join(' · ') || 'Customer'}
      </Button>)}
    </View>}
    <Text variant="titleSmall">Discount type</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      <Button mode={discountType === 'percent' ? 'contained' : 'outlined'} accessibilityState={{ selected: discountType === 'percent' }} onPress={() => setDiscountType('percent')}>Percentage (%)</Button>
      <Button mode={discountType === 'fixed' ? 'contained' : 'outlined'} accessibilityState={{ selected: discountType === 'fixed' }} onPress={() => setDiscountType('fixed')}>Fixed amount ($)</Button>
    </View>
    <FormField label={discountType === 'percent' ? 'Percentage (up to 100%)' : 'Discount amount ($)'} value={discountValue} onChangeText={setDiscountValue} keyboardType="decimal-pad" />
    <FormField label="Coupon code" value={code} onChangeText={setCode} autoCapitalize="characters" autoCorrect={false} maxLength={64} />
    <FormField label="Title" value={title} onChangeText={setTitle} />
    <Checkbox.Item label="Send coupon email to customer" status={sendEmail ? 'checked' : 'unchecked'} onPress={() => setSendEmail((current) => !current)} disabled={saving || !(customer?.profileId || customer?.email?.trim())} position="leading" style={{ paddingHorizontal: 0 }} />
    <HelperText type="info">{customer?.profileId ? "Uses the email address currently saved on this customer's profile." : customer?.email?.trim() ? `Send to ${customer.email.trim()}. You can resend this coupon later while it remains active.` : 'Select a customer with an email address to send a coupon email.'}</HelperText>
    <HelperText type="info">Active immediately · One use · No expiry · No minimum spend. The discount cannot exceed the order subtotal.</HelperText>
  </EditorSheet>;
}
