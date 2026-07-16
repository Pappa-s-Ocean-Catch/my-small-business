import React, { useState } from 'react';
import { View } from 'react-native';
import { Button, SegmentedButtons } from 'react-native-paper';
import type { DateTimePickerEvent } from '@react-native-community/datetimepicker';

import { styles } from './pos.styles';
import type { PosInstorePaymentChoice } from '../../app/pos.types';
import { PosInstoreCheckoutForm } from './PosInstoreCheckoutForm';
import { PosDeliveryCheckoutForm } from './PosDeliveryCheckoutForm';
import { PosPickupCheckoutForm } from './PosPickupCheckoutForm';
import type { DeliveryAddressDraft, DeliveryQuoteResult } from '../../lib/delivery';

export type CustomerLookupStatus = 'idle' | 'loading' | 'found' | 'new' | 'error';
type CheckoutTab = 'pickup' | 'instore' | 'delivery';

type Props = {
  closeCheckout: () => void;
  customerLookupStatus: CustomerLookupStatus;
  customerPhone: string;
  setCustomerPhone: (value: string) => void;
  customerName: string;
  setCustomerName: (value: string) => void;
  customerLookupError: string | null;
  totals: { subtotal: number; tax: number; total: number };
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
  setCustomerPhone,
  customerName,
  setCustomerName,
  customerLookupError,
  totals,
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
      {activeTab === 'instore' && (
        <PosInstoreCheckoutForm
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
          handleInstoreCheckout={handleInstoreCheckout}
          smartpayPaired={smartpayPaired}
          handleSmartpayInstoreCheckout={handleSmartpayInstoreCheckout}
        />
      )}

      {activeTab === 'pickup' && (
        <PosPickupCheckoutForm
          customerLookupStatus={customerLookupStatus}
          customerPhone={customerPhone}
          setCustomerPhone={setCustomerPhone}
          customerName={customerName}
          setCustomerName={setCustomerName}
          customerLookupError={customerLookupError}
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
          setCustomerPhone={setCustomerPhone}
          customerName={customerName}
          setCustomerName={setCustomerName}
          customerLookupError={customerLookupError}
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
