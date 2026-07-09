import React from 'react';
import { Platform, ScrollView, Text, View } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Button, TextInput } from 'react-native-paper';

import { styles } from '../../app/pos.styles';
import type { CustomerLookupStatus } from './PosCheckoutPanel';

type Props = {
  customerLookupStatus: CustomerLookupStatus;
  customerPhone: string;
  setCustomerPhone: (value: string) => void;
  customerName: string;
  setCustomerName: (value: string) => void;
  customerLookupError: string | null;
  totals: { total: number };
  cartItemsCount: number;
  isPreOrder: boolean;
  setIsPreOrder: (value: boolean) => void;
  scheduledPickupAt: Date;
  setScheduledPickupAt: React.Dispatch<React.SetStateAction<Date>>;
  defaultPickupTime: () => Date;
  formatPickupTime: (date: Date) => string;
  openPickupPicker: (mode: 'date' | 'time') => void;
  showPickupPicker: boolean;
  pickupPickerMode: 'date' | 'time';
  handlePickupPickerChange: (event: DateTimePickerEvent, date?: Date) => void;
  orderNoteText: string;
  setOrderNoteText: (value: string) => void;
  creatingOrder: boolean;
  smartpayProcessing: boolean;
  orderId?: string;
  checkoutPrimaryLabel: string;
  handleCheckout: (override?: 'card' | 'cash' | 'no_pay' | 'smartpay') => Promise<void>;
};

export function PosPickupCheckoutForm({
  customerLookupStatus,
  customerPhone,
  setCustomerPhone,
  customerName,
  setCustomerName,
  customerLookupError,
  totals,
  cartItemsCount,
  isPreOrder,
  setIsPreOrder,
  scheduledPickupAt,
  setScheduledPickupAt,
  defaultPickupTime,
  formatPickupTime,
  openPickupPicker,
  showPickupPicker,
  pickupPickerMode,
  handlePickupPickerChange,
  orderNoteText,
  setOrderNoteText,
  creatingOrder,
  smartpayProcessing,
  orderId,
  checkoutPrimaryLabel,
  handleCheckout,
}: Props) {
  return (
    <ScrollView
      style={styles.checkoutBody}
      contentContainerStyle={styles.checkoutContent}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.checkoutFormFull}>
        <View style={styles.checkoutSummaryCard}>
          <Text style={styles.checkoutSummaryEyebrow}>Pickup order</Text>
          <Text style={styles.checkoutSummaryTotal}>${totals.total.toFixed(2)}</Text>
          <Text style={styles.checkoutSummaryMeta}>
            {cartItemsCount} items • {isPreOrder ? 'Pre-order pickup' : 'ASAP pickup'}
          </Text>
          <Text style={styles.checkoutSummaryMeta}>Payment: Unpaid</Text>
        </View>

        <TextInput
          label="Phone"
          mode="outlined"
          value={customerPhone}
          onChangeText={(value) => {
            setCustomerPhone(value);
            if (customerLookupStatus === 'found') setCustomerName('');
          }}
          keyboardType="phone-pad"
          style={styles.checkoutInput}
        />
        <View style={styles.lookupRow}>
          {customerLookupStatus === 'loading' && <Text style={styles.lookupText}>Looking up customer...</Text>}
          {customerLookupStatus === 'found' && <Text style={styles.foundText}>Existing customer found</Text>}
          {customerLookupStatus === 'new' && <Text style={styles.newText}>No customer found. A new customer will be created.</Text>}
          {customerLookupStatus === 'error' && <Text style={styles.errorText}>{customerLookupError}</Text>}
        </View>
        <TextInput
          label="Name"
          mode="outlined"
          value={customerName}
          onChangeText={setCustomerName}
          style={styles.checkoutInput}
        />

        <View style={styles.pickupPanel}>
          <Text style={styles.checkoutSectionTitle}>Pickup timing</Text>
          <View style={styles.pickupModeRow}>
            <Button mode={!isPreOrder ? 'contained' : 'outlined'} onPress={() => setIsPreOrder(false)} style={styles.pickupModeButton}>
              ASAP
            </Button>
            <Button
              mode={isPreOrder ? 'contained' : 'outlined'}
              onPress={() => {
                setIsPreOrder(true);
                setScheduledPickupAt((current) => (
                  current.getTime() > Date.now() ? current : defaultPickupTime()
                ));
              }}
              style={styles.pickupModeButton}
            >
              Pre-order
            </Button>
          </View>
          {isPreOrder && (
            <View style={styles.preOrderPanel}>
              <Text style={styles.preOrderBadge}>PRE-ORDER</Text>
              <Text style={styles.pickupTimeText}>{formatPickupTime(scheduledPickupAt)}</Text>
              <View style={styles.pickupPickerButtons}>
                <Button mode="outlined" icon="calendar" onPress={() => openPickupPicker('date')} style={styles.pickupPickerButton}>
                  Date
                </Button>
                <Button mode="outlined" icon="clock-outline" onPress={() => openPickupPicker('time')} style={styles.pickupPickerButton}>
                  Time
                </Button>
              </View>
              {showPickupPicker && (
                <DateTimePicker
                  value={scheduledPickupAt.getTime() > Date.now() ? scheduledPickupAt : defaultPickupTime()}
                  mode={pickupPickerMode}
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  minimumDate={new Date()}
                  onChange={handlePickupPickerChange}
                />
              )}
            </View>
          )}
        </View>

        <TextInput
          label="Order note"
          mode="outlined"
          value={orderNoteText}
          onChangeText={setOrderNoteText}
          multiline
          style={[styles.checkoutInput, styles.checkoutNoteInput, styles.checkoutNoteInputLarge]}
        />

        <Button
          mode="contained"
          icon="check"
          loading={creatingOrder}
          disabled={creatingOrder || smartpayProcessing || cartItemsCount === 0 || (!orderId && !customerPhone.trim())}
          onPress={() => void handleCheckout('no_pay')}
          style={styles.placeOrderButton}
          buttonColor="#16a34a"
        >
          {checkoutPrimaryLabel}
        </Button>
      </View>
    </ScrollView>
  );
}
