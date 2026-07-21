import React, { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Button, TextInput } from 'react-native-paper';

import { styles } from './pos.styles';
import type { PosInstorePaymentChoice } from '../../app/pos.types';
import { PosDiscountSection } from './PosDiscountSection';
import { PosCustomerSelector } from './PosCustomerSelector';
import type { CustomerLookupStatus } from './PosCheckoutPanel';
import type { Customer } from '../../lib/customers';

type Props = {
  discountLabel: string;
  discountAmount: number;
  activeDiscountPercent: number | null;
  selectDiscountPreset: (percent: number) => void;
  openDiscountDialog: () => void;
  customerLookupStatus: CustomerLookupStatus;
  customerPhone: string;
  onChangeCustomerPhone: (value: string) => void;
  customerName: string;
  onChangeCustomerName: (value: string) => void;
  customerLookupError: string | null;
  selectedCustomer: Customer | null;
  onSelectCustomer: (customer: Customer) => void;
  onClearCustomer: () => void;
  onResetToDefaultInstore: () => void;
  rewardPointsEnabled: boolean;
  rewardPointsBalance: number;
  rewardPointsDollarValue: number;
  rewardPointsApplied: boolean;
  appliedRewardPointsValue: number;
  onToggleRewardPoints: () => void;
  cartItemsCount: number;
  orderNoteText: string;
  setOrderNoteText: (value: string) => void;
  creatingOrder: boolean;
  smartpayProcessing: boolean;
  handleInstoreCheckout: (payment: PosInstorePaymentChoice) => Promise<void>;
  smartpayPaired: boolean;
  handleSmartpayInstoreCheckout: () => Promise<void>;
};

export function PosInstoreCheckoutForm({
  discountLabel,
  discountAmount,
  activeDiscountPercent,
  selectDiscountPreset,
  openDiscountDialog,
  customerLookupStatus,
  customerPhone,
  onChangeCustomerPhone,
  customerName,
  onChangeCustomerName,
  customerLookupError,
  selectedCustomer,
  onSelectCustomer,
  onClearCustomer,
  onResetToDefaultInstore,
  rewardPointsEnabled,
  rewardPointsBalance,
  rewardPointsDollarValue,
  rewardPointsApplied,
  appliedRewardPointsValue,
  onToggleRewardPoints,
  cartItemsCount,
  orderNoteText,
  setOrderNoteText,
  creatingOrder,
  smartpayProcessing,
  handleInstoreCheckout,
  smartpayPaired,
  handleSmartpayInstoreCheckout,
}: Props) {
  const [paymentChoice, setPaymentChoice] = useState<PosInstorePaymentChoice>('card');

  const primaryLabel = paymentChoice === 'unpaid'
    ? 'Create In-store Order • Unpaid'
    : paymentChoice === 'cash'
      ? 'Create In-store Order • Cash'
      : 'Create In-store Order • Card';

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
          onResetToDefaultInstore={onResetToDefaultInstore}
          rewardPointsEnabled={rewardPointsEnabled}
          rewardPointsBalance={rewardPointsBalance}
          rewardPointsDollarValue={rewardPointsDollarValue}
          rewardPointsApplied={rewardPointsApplied}
          appliedRewardPointsValue={appliedRewardPointsValue}
          onToggleRewardPoints={onToggleRewardPoints}
          allowEmptyPhone
        />

        <PosDiscountSection
          discountLabel={discountLabel}
          discountAmount={discountAmount}
          activeDiscountPercent={activeDiscountPercent}
          onSelectPreset={selectDiscountPreset}
          onOpenMore={openDiscountDialog}
        />

        <View style={styles.paymentPanel}>
          <Text style={styles.checkoutSectionTitle}>Payment</Text>
          <View style={styles.paymentModeRow}>
            <Button mode={paymentChoice === 'card' ? 'contained' : 'outlined'} icon="credit-card-outline" onPress={() => setPaymentChoice('card')} style={styles.paymentModeButton}>
              CARD
            </Button>
            <Button mode={paymentChoice === 'cash' ? 'contained' : 'outlined'} icon="cash" onPress={() => setPaymentChoice('cash')} style={styles.paymentModeButton}>
              CASH
            </Button>
            <Button mode={paymentChoice === 'unpaid' ? 'contained' : 'outlined'} icon="clock-outline" onPress={() => setPaymentChoice('unpaid')} style={styles.paymentModeButton}>
              UNPAID
            </Button>
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
          disabled={creatingOrder || smartpayProcessing || cartItemsCount === 0}
          onPress={() => void handleInstoreCheckout(paymentChoice)}
          style={styles.placeOrderButton}
          buttonColor="#dc2626"
        >
          {primaryLabel}
        </Button>

        <View style={styles.secondaryActionsPanel}>
          <Text style={styles.secondaryActionsTitle}>Quick actions</Text>
          <View style={styles.secondaryActionsRow}>
            <Button
              mode="contained"
              icon="credit-card-wireless-outline"
              loading={smartpayProcessing}
              disabled={!smartpayPaired || creatingOrder || smartpayProcessing || cartItemsCount === 0}
              onPress={() => void handleSmartpayInstoreCheckout()}
              style={styles.secondaryActionButton}
              buttonColor="#2563eb"
            >
              SmartPay
            </Button>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
