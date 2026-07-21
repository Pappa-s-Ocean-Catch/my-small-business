import React from 'react';
import { Platform, ScrollView, Text, View } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Button, TextInput } from 'react-native-paper';

import { styles } from './pos.styles';
import type { CustomerLookupStatus } from './PosCheckoutPanel';
import { PosDiscountSection } from './PosDiscountSection';
import { PosCustomerSelector } from './PosCustomerSelector';
import type { Customer } from '../../lib/customers';

type Props = {
  customerLookupStatus: CustomerLookupStatus;
  customerPhone: string;
  onChangeCustomerPhone: (value: string) => void;
  customerName: string;
  onChangeCustomerName: (value: string) => void;
  customerLookupError: string | null;
  selectedCustomer: Customer | null;
  onSelectCustomer: (customer: Customer) => void;
  onClearCustomer: () => void;
  rewardPointsEnabled: boolean;
  rewardPointsBalance: number;
  rewardPointsDollarValue: number;
  rewardPointsApplied: boolean;
  appliedRewardPointsValue: number;
  onToggleRewardPoints: () => void;
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
  onChangeCustomerPhone,
  customerName,
  onChangeCustomerName,
  customerLookupError,
  selectedCustomer,
  onSelectCustomer,
  onClearCustomer,
  rewardPointsEnabled,
  rewardPointsBalance,
  rewardPointsDollarValue,
  rewardPointsApplied,
  appliedRewardPointsValue,
  onToggleRewardPoints,
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
  return (
    <ScrollView
      style={styles.checkoutBody}
      contentContainerStyle={styles.checkoutContent}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.checkoutFormFull}>
        <PosCustomerSelector
          customerLookupStatus={customerLookupStatus}
          customerPhone={customerPhone}
          onChangePhone={onChangeCustomerPhone}
          customerName={customerName}
          onChangeName={onChangeCustomerName}
          customerLookupError={customerLookupError}
          selectedCustomer={selectedCustomer}
          onSelectCustomer={onSelectCustomer}
          onClearCustomer={onClearCustomer}
          rewardPointsEnabled={rewardPointsEnabled}
          rewardPointsBalance={rewardPointsBalance}
          rewardPointsDollarValue={rewardPointsDollarValue}
          rewardPointsApplied={rewardPointsApplied}
          appliedRewardPointsValue={appliedRewardPointsValue}
          onToggleRewardPoints={onToggleRewardPoints}
        />

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
      </View>
    </ScrollView>
  );
}
