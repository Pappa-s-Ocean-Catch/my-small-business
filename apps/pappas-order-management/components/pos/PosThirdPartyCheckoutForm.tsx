import React from 'react';
import { Platform, ScrollView, Text, View } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Button, TextInput } from 'react-native-paper';

import { styles } from './pos.styles';
import type { PosThirdPartySource } from '../../app/pos.types';

type Props = {
  partyName: PosThirdPartySource;
  onChangePartyName: (value: PosThirdPartySource) => void;
  customerName: string;
  onChangeCustomerName: (value: string) => void;
  externalOrderId: string;
  onChangeExternalOrderId: (value: string) => void;
  cartItemsCount: number;
  thirdPartyOrderAt: Date;
  formatOrderTime: (date: Date) => string;
  openOrderAtPicker: (mode: 'date' | 'time') => void;
  showOrderAtPicker: boolean;
  orderAtPickerMode: 'date' | 'time';
  handleOrderAtPickerChange: (event: DateTimePickerEvent, date?: Date) => void;
  orderNoteText: string;
  setOrderNoteText: (value: string) => void;
  creatingOrder: boolean;
  smartpayProcessing: boolean;
  onSubmit: () => Promise<void>;
};

export function PosThirdPartyCheckoutForm({
  partyName,
  onChangePartyName,
  customerName,
  onChangeCustomerName,
  externalOrderId,
  onChangeExternalOrderId,
  cartItemsCount,
  thirdPartyOrderAt,
  formatOrderTime,
  openOrderAtPicker,
  showOrderAtPicker,
  orderAtPickerMode,
  handleOrderAtPickerChange,
  orderNoteText,
  setOrderNoteText,
  creatingOrder,
  smartpayProcessing,
  onSubmit,
}: Props) {
  const externalOrderIdValue = externalOrderId.trim();

  return (
    <ScrollView
      style={styles.checkoutBody}
      contentContainerStyle={styles.checkoutContent}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.checkoutFormFull}>
        <View style={styles.paymentPanel}>
          <Text style={styles.checkoutSectionTitle}>Third-party source</Text>
          <View style={styles.paymentModeRow}>
            <Button
              mode={partyName === 'Uber Eats' ? 'contained' : 'outlined'}
              icon="storefront-outline"
              onPress={() => onChangePartyName('Uber Eats')}
              style={styles.paymentModeButton}
            >
              UBER EATS
            </Button>
            <Button
              mode={partyName === 'DoorDash' ? 'contained' : 'outlined'}
              icon="storefront-outline"
              onPress={() => onChangePartyName('DoorDash')}
              style={styles.paymentModeButton}
            >
              DOORDASH
            </Button>
          </View>
          <Text style={styles.lookupText}>These orders are saved as paid because payment is handled on the marketplace.</Text>
        </View>

        <TextInput
          label="Customer name"
          mode="outlined"
          value={customerName}
          onChangeText={onChangeCustomerName}
          style={styles.checkoutInput}
        />

        <TextInput
          label="External order ID"
          mode="outlined"
          value={externalOrderId}
          onChangeText={onChangeExternalOrderId}
          autoCapitalize="characters"
          style={styles.checkoutInput}
        />

        <View style={styles.pickupPanel}>
          <Text style={styles.checkoutSectionTitle}>Order time</Text>
          <View style={styles.preOrderPanel}>
            <Text style={styles.preOrderBadge}>ORDER TIME</Text>
            <Text style={styles.pickupTimeText}>{formatOrderTime(thirdPartyOrderAt)}</Text>
            <View style={styles.pickupPickerButtons}>
              <Button mode="outlined" icon="calendar" onPress={() => openOrderAtPicker('date')} style={styles.pickupPickerButton}>
                Date
              </Button>
              <Button mode="outlined" icon="clock-outline" onPress={() => openOrderAtPicker('time')} style={styles.pickupPickerButton}>
                Time
              </Button>
            </View>
            {showOrderAtPicker && (
              <DateTimePicker
                value={thirdPartyOrderAt}
                mode={orderAtPickerMode}
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handleOrderAtPickerChange}
              />
            )}
          </View>
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
          disabled={creatingOrder || smartpayProcessing || cartItemsCount === 0 || !externalOrderIdValue}
          onPress={() => void onSubmit()}
          style={styles.placeOrderButton}
          buttonColor="#0f766e"
        >
          Create Third-Party Order • Paid
        </Button>
      </View>
    </ScrollView>
  );
}
