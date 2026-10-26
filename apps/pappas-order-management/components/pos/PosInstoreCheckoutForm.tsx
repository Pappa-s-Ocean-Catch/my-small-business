import { ActionButton as Button } from '@/components/ui/ActionButton';
import React, { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { FormField } from '@/components/ui';
import { designTokens as tokens } from '@/lib/redesign';

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
  smartpayPreparing: boolean;
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
  smartpayPreparing,
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
            {(['card', 'cash', 'unpaid'] as const).map(choice => <Button key={choice} mode="outlined" onPress={() => setPaymentChoice(choice)} style={[styles.paymentModeButton, paymentChoice === choice && { borderColor: tokens.color.primary }]} buttonColor={paymentChoice === choice ? tokens.color.primaryTint : tokens.color.surface} textColor={paymentChoice === choice ? tokens.color.primaryPressed : tokens.color.text} contentStyle={{ minHeight: 44 }} labelStyle={{ fontSize: 13 }} hitSlop={2}>{choice[0].toUpperCase() + choice.slice(1)}</Button>)}
          </View>
          <Text style={{ color: tokens.color.muted, fontSize: 13 }}>Choose a method when completing this order.</Text>
        </View>

        <FormField
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
          loading={creatingOrder && !smartpayPreparing}
          disabled={creatingOrder || smartpayPreparing || smartpayProcessing || cartItemsCount === 0}
          onPress={() => void handleInstoreCheckout(paymentChoice)}
          style={styles.placeOrderButton}
          buttonColor={tokens.color.primary}
        >
          {primaryLabel}
        </Button>

        <View style={styles.secondaryActionsPanel}>
          <Text style={styles.secondaryActionsTitle}>Quick actions</Text>
          <View style={styles.secondaryActionsRow}>
            <Button
              mode="contained"
              icon="credit-card-wireless-outline"
              loading={smartpayPreparing || smartpayProcessing}
              disabled={!smartpayPaired || creatingOrder || smartpayPreparing || smartpayProcessing || cartItemsCount === 0}
              onPress={() => void handleSmartpayInstoreCheckout()}
              style={styles.secondaryActionButton}
              buttonColor={tokens.color.primary}
            >
              SmartPay
            </Button>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
