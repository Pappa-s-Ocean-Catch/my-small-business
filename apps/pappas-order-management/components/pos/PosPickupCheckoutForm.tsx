import React, { useState } from 'react';
import { Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Button, TextInput } from 'react-native-paper';

import { styles } from './pos.styles';
import type { CustomerLookupStatus } from './PosCheckoutPanel';
import { PosDiscountSection } from './PosDiscountSection';
import { PosPhoneInputModal } from './PosPhoneInputModal';
import { PosTextInputModal } from './PosTextInputModal';

type Props = {
  customerLookupStatus: CustomerLookupStatus;
  customerPhone: string;
  setCustomerPhone: (value: string) => void;
  customerName: string;
  setCustomerName: (value: string) => void;
  customerLookupError: string | null;
  discountLabel: string;
  discountAmount: number;
  activeDiscountPercent: number | null;
  selectDiscountPreset: (percent: number) => void;
  openDiscountDialog: () => void;
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
  discountLabel,
  discountAmount,
  activeDiscountPercent,
  selectDiscountPreset,
  openDiscountDialog,
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
  const [phoneModalVisible, setPhoneModalVisible] = useState(false);
  const [nameModalVisible, setNameModalVisible] = useState(false);

  return (
    <ScrollView
      style={styles.checkoutBody}
      contentContainerStyle={styles.checkoutContent}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.checkoutFormFull}>
        <View style={styles.customerIdentityRow}>
          <TouchableOpacity
            style={[styles.phoneTrigger, styles.customerIdentityField]}
            onPress={() => setPhoneModalVisible(true)}
          >
            <Text style={styles.phoneTriggerLabel}>Phone</Text>
            <Text style={[styles.phoneTriggerValue, !customerPhone ? styles.phoneTriggerPlaceholder : null]} numberOfLines={1}>
              {customerPhone || '04'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.phoneTrigger, styles.customerIdentityField]}
            onPress={() => setNameModalVisible(true)}
          >
            <Text style={styles.phoneTriggerLabel}>Name</Text>
            <Text style={[styles.phoneTriggerValue, !customerName ? styles.phoneTriggerPlaceholder : null]} numberOfLines={1}>
              {customerName || 'Tap to enter'}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.lookupRow}>
          {customerLookupStatus === 'loading' && <Text style={styles.lookupText}>Looking up customer...</Text>}
          {customerLookupStatus === 'found' && <Text style={styles.foundText}>Existing customer found</Text>}
          {customerLookupStatus === 'new' && <Text style={styles.newText}>No customer found. A new customer will be created.</Text>}
          {customerLookupStatus === 'error' && <Text style={styles.errorText}>{customerLookupError}</Text>}
        </View>

        <PosDiscountSection
          discountLabel={discountLabel}
          discountAmount={discountAmount}
          activeDiscountPercent={activeDiscountPercent}
          onSelectPreset={selectDiscountPreset}
          onOpenMore={openDiscountDialog}
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
        <PosPhoneInputModal
          visible={phoneModalVisible}
          value={customerPhone}
          onDismiss={() => setPhoneModalVisible(false)}
          onSave={(value) => {
            setCustomerPhone(value);
            if (customerLookupStatus === 'found') setCustomerName('');
            setPhoneModalVisible(false);
          }}
        />
        <PosTextInputModal
          visible={nameModalVisible}
          title="Enter Customer Name"
          value={customerName}
          onDismiss={() => setNameModalVisible(false)}
          onSave={(value) => {
            setCustomerName(value);
            setNameModalVisible(false);
          }}
        />
      </View>
    </ScrollView>
  );
}
