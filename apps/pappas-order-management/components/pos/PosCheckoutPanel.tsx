import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Button, SegmentedButtons } from 'react-native-paper';
import type { DateTimePickerEvent } from '@react-native-community/datetimepicker';

import { styles } from './pos.styles';
import type { PosInstorePaymentChoice } from '../../app/pos.types';
import { PosInstoreCheckoutForm } from './PosInstoreCheckoutForm';
import { PosDeliveryCheckoutForm } from './PosDeliveryCheckoutForm';
import { PosPickupCheckoutForm } from './PosPickupCheckoutForm';
import type { DeliveryAddressDraft, DeliveryQuoteResult } from '../../lib/delivery';
import type { Customer } from '../../lib/customers';

export type CustomerLookupStatus = 'idle' | 'loading' | 'found' | 'new' | 'error';
type CheckoutTab = 'pickup' | 'instore' | 'delivery';

type Props = {
  closeCheckout: () => void;
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
  totals: { subtotal: number; tax: number; total: number };
  freeItemPromotionTitle?: string | null;
  freeItemSelectionRequired: boolean;
  selectedFreeItemName?: string | null;
  onOpenFreeItemDialog: () => void;
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
  smartpayPaired: boolean;
  handleInstoreCheckout: (payment: PosInstorePaymentChoice) => Promise<void>;
  handleSmartpayInstoreCheckout: () => Promise<void>;
  handleDeliveryCheckout: (input: {
    address: DeliveryAddressDraft;
    quote: DeliveryQuoteResult;
  }) => Promise<void>;
};

export function PosCheckoutPanel({
  closeCheckout,
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
  totals,
  freeItemPromotionTitle,
  freeItemSelectionRequired,
  selectedFreeItemName,
  onOpenFreeItemDialog,
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
  smartpayPaired,
  handleInstoreCheckout,
  handleSmartpayInstoreCheckout,
  handleDeliveryCheckout,
}: Props) {
  const [activeTab, setActiveTab] = useState<CheckoutTab>('pickup');

  return (
    <View style={styles.checkoutPane}>
      <View style={styles.checkoutTopBar}>
        <Button mode="outlined" icon="arrow-left" onPress={closeCheckout} style={styles.backButton}>
          Order
        </Button>
        <SegmentedButtons
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as CheckoutTab)}
          style={styles.checkoutSegmentedButtons}
          buttons={[
            { value: 'instore', label: 'INSTORE' },
            { value: 'pickup', label: 'PICKUP' },
            { value: 'delivery', label: 'DELIVERY' },
          ]}
        />
      </View>
      {freeItemPromotionTitle ? (
        <View style={[styles.discountCard, freeItemSelectionRequired ? styles.discountCardActive : null, { marginHorizontal: 16, marginTop: 12 }]}>
          <View style={styles.discountCardText}>
            <Text style={[styles.discountCardTitle, freeItemSelectionRequired ? styles.discountCardTitleActive : null]}>
              {freeItemSelectionRequired ? 'Free item unlocked' : 'Free item selected'}
            </Text>
            <Text style={[styles.discountCardValue, freeItemSelectionRequired ? styles.discountCardValueActive : null]}>
              {selectedFreeItemName || freeItemPromotionTitle}
            </Text>
          </View>
          <Button mode="contained-tonal" onPress={onOpenFreeItemDialog}>
            {selectedFreeItemName ? 'Change' : 'Choose'}
          </Button>
        </View>
      ) : null}
      {activeTab === 'instore' && (
        <PosInstoreCheckoutForm
          discountLabel={discountLabel}
          discountAmount={discountAmount}
          activeDiscountPercent={activeDiscountPercent}
          selectDiscountPreset={selectDiscountPreset}
          openDiscountDialog={openDiscountDialog}
          customerLookupStatus={customerLookupStatus}
          customerPhone={customerPhone}
          onChangeCustomerPhone={onChangeCustomerPhone}
          customerName={customerName}
          onChangeCustomerName={onChangeCustomerName}
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
          cartItemsCount={cartItemsCount}
          orderNoteText={orderNoteText}
          setOrderNoteText={setOrderNoteText}
          creatingOrder={creatingOrder}
          smartpayProcessing={smartpayProcessing}
          handleInstoreCheckout={handleInstoreCheckout}
          smartpayPaired={smartpayPaired}
          handleSmartpayInstoreCheckout={handleSmartpayInstoreCheckout}
        />
      )}

      {activeTab === 'pickup' && (
        <PosPickupCheckoutForm
          customerLookupStatus={customerLookupStatus}
          customerPhone={customerPhone}
          onChangeCustomerPhone={onChangeCustomerPhone}
          customerName={customerName}
          onChangeCustomerName={onChangeCustomerName}
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
          discountLabel={discountLabel}
          discountAmount={discountAmount}
          activeDiscountPercent={activeDiscountPercent}
          selectDiscountPreset={selectDiscountPreset}
          openDiscountDialog={openDiscountDialog}
          cartItemsCount={cartItemsCount}
          isPreOrder={isPreOrder}
          setIsPreOrder={setIsPreOrder}
          scheduledPickupAt={scheduledPickupAt}
          setScheduledPickupAt={setScheduledPickupAt}
          defaultPickupTime={defaultPickupTime}
          formatPickupTime={formatPickupTime}
          openPickupPicker={openPickupPicker}
          showPickupPicker={showPickupPicker}
          pickupPickerMode={pickupPickerMode}
          handlePickupPickerChange={handlePickupPickerChange}
          orderNoteText={orderNoteText}
          setOrderNoteText={setOrderNoteText}
          creatingOrder={creatingOrder}
          smartpayProcessing={smartpayProcessing}
          orderId={orderId}
          checkoutPrimaryLabel={checkoutPrimaryLabel}
          handleCheckout={handleCheckout}
        />
      )}

      {activeTab === 'delivery' && (
        <PosDeliveryCheckoutForm
          customerLookupStatus={customerLookupStatus}
          customerPhone={customerPhone}
          onChangeCustomerPhone={onChangeCustomerPhone}
          customerName={customerName}
          onChangeCustomerName={onChangeCustomerName}
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
          totals={totals}
          discountLabel={discountLabel}
          discountAmount={discountAmount}
          activeDiscountPercent={activeDiscountPercent}
          selectDiscountPreset={selectDiscountPreset}
          openDiscountDialog={openDiscountDialog}
          cartItemsCount={cartItemsCount}
          orderNoteText={orderNoteText}
          setOrderNoteText={setOrderNoteText}
          creatingOrder={creatingOrder}
          smartpayProcessing={smartpayProcessing}
          onSubmitDeliveryOrder={handleDeliveryCheckout}
        />
      )}
    </View>
  );
}
