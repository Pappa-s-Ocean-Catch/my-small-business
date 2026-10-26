import { ActionButton as Button } from '@/components/ui/ActionButton';
import React, { useState } from 'react';
import { Platform, ScrollView, Text, View } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { FormField } from '@/components/ui';
import { ChoiceTabs } from '@/components/ui/ChoiceTabs';
import { designTokens as tokens } from '@/lib/redesign';

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
  const [timeExpanded, setTimeExpanded] = useState(false);

  return (
    <ScrollView
      style={styles.checkoutBody}
      contentContainerStyle={styles.checkoutContent}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.checkoutFormFull}>
        <View style={styles.pickupPanel}>
          <Text style={styles.checkoutSectionTitle}>External order</Text>
          <ChoiceTabs
            variant="choices"
            value={partyName}
            onValueChange={(value) => onChangePartyName(value as PosThirdPartySource)}
            buttons={[{ value: 'Uber Eats', label: 'Uber Eats' }, { value: 'DoorDash', label: 'DoorDash' }]}
          />
          <FormField
            label="Customer name"
            placeholder="Customer name"
            value={customerName}
            onChangeText={onChangeCustomerName}
            style={styles.checkoutInput}
          />
          <FormField
            label="External order ID"
            placeholder="External order ID"
            value={externalOrderId}
            onChangeText={onChangeExternalOrderId}
            autoCapitalize="characters"
            style={styles.checkoutInput}
          />
          <Text style={{ color: tokens.color.muted, fontSize: 13, lineHeight: 20 }}>
            Payment is handled by the selected marketplace.
          </Text>
        </View>

        <View style={styles.pickupPanel}>
          <Button mode="text" onPress={() => setTimeExpanded((expanded) => !expanded)}
            icon={timeExpanded ? 'chevron-up' : 'chevron-down'}
            contentStyle={{ justifyContent: 'flex-start', minHeight: 44 }}>
            Order time · {formatOrderTime(thirdPartyOrderAt)}
          </Button>
          {timeExpanded && <View style={styles.preOrderPanel}>
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
          </View>}
        </View>

        <FormField
          label="Order note"
          mode="outlined"
          placeholder="Order note"
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
          buttonColor={tokens.color.primary}
        >
          Create Third-Party Order • Paid
        </Button>
      </View>
    </ScrollView>
  );
}
