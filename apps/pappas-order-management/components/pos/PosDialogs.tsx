import { FullScreenModal } from '@/components/ui/FullScreenModal';
import { SelectionSheet } from '@/components/ui/SelectionSheet';
import { EditorSheet, FormField } from '@/components/ui';
import { ChoiceTabs } from '@/components/ui/ChoiceTabs';
import { designTokens as t } from '@/lib/redesign';
import { ActionButton as Button } from '@/components/ui/ActionButton';
import { ResponsiveDialog as Dialog } from '@/components/ui/ResponsiveDialog';
import React, { useCallback, useEffect, useState } from 'react';
import { Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Portal, TextInput } from 'react-native-paper';

import { getCouponsList, validateCouponCode, type Coupon } from '../../lib/coupons';
import { findCustomerById, findCustomerByEmail, type Customer } from '../../lib/customers';
import { CashTenderModal } from '../CashTenderModal';
import { styles } from './pos.styles';
import { hasNotePreset, toggleNotePreset } from '../../lib/note-presets';
import type { CashTenderMode, PosInstorePaymentChoice, SaleProduct } from '../../app/pos.types';
import type { EditedOrderPaymentChoice } from '../../lib/edit-order-payment';
import {
  getSmartpayCheckoutProgress,
  type SmartpayCheckoutProgressStage,
} from '../../lib/instore-smartpay-checkout';

type Props = {
  cashTenderMode: CashTenderMode | null;
  total: number;
  cartSubtotal?: number;
  selectedCustomer?: { id?: string; email?: string } | null;
  onCancelCashTender: () => void;
  onConfirmCashTender: () => void;
  smartpayProcessing: boolean;
  smartpayPaired: boolean;
  smartpayOrderNumber: string | null;
  smartpayProgressStage: SmartpayCheckoutProgressStage | null;
  smartpayDialogMinimized: boolean;
  confirmDismissSmartpayLock: () => void;
  saltOptionDialogVisible: boolean;
  setSaltOptionDialogVisible: (visible: boolean) => void;
  quickOrderNotes: string[];
  quickOrderNote: string | null;
  setQuickOrderNote: (value: string | null) => void;
  quickItemNotes: string[];
  noteItemId: string | null;
  closeNoteEditor: () => void;
  noteDraft: string;
  setNoteDraft: (value: string) => void;
  saveNote: () => void;
  instorePaymentDialogVisible: boolean;
  setInstorePaymentDialogVisible: (visible: boolean) => void;
  isEditingOrder: boolean;
  onChooseInstorePayment: (choice: PosInstorePaymentChoice | EditedOrderPaymentChoice) => void;
  freeItemDialogVisible: boolean;
  setFreeItemDialogVisible: (visible: boolean) => void;
  eligibleFreeItemProducts: SaleProduct[];
  onSelectFreeItem: (product: SaleProduct) => void;
  discountDialogVisible: boolean;
  setDiscountDialogVisible: (visible: boolean) => void;
  discountLabel: string;
  discountAmount: number;
  onApplyPresetDiscount: (percent: number) => void;
  onApplyCustomPercentDiscount: (percent: number) => void;
  onApplyCustomFixedDiscount: (amount: number) => void;
  onApplyCouponDiscount?: (coupon: Coupon, discountAmount: number, customer?: Customer | null) => void;
  onClearDiscount: () => void;
};

export function PosDialogs({
  cashTenderMode,
  total,
  cartSubtotal,
  selectedCustomer,
  onCancelCashTender,
  onConfirmCashTender,
  smartpayProcessing,
  smartpayPaired,
  smartpayOrderNumber,
  smartpayProgressStage,
  smartpayDialogMinimized,
  confirmDismissSmartpayLock,
  saltOptionDialogVisible,
  setSaltOptionDialogVisible,
  quickOrderNotes,
  quickOrderNote,
  setQuickOrderNote,
  quickItemNotes,
  noteItemId,
  closeNoteEditor,
  noteDraft,
  setNoteDraft,
  saveNote,
  instorePaymentDialogVisible,
  setInstorePaymentDialogVisible,
  isEditingOrder,
  onChooseInstorePayment,
  freeItemDialogVisible,
  setFreeItemDialogVisible,
  eligibleFreeItemProducts,
  onSelectFreeItem,
  discountDialogVisible,
  setDiscountDialogVisible,
  discountLabel,
  discountAmount,
  onApplyPresetDiscount,
  onApplyCustomPercentDiscount,
  onApplyCustomFixedDiscount,
  onApplyCouponDiscount,
  onClearDiscount,
}: Props) {
  const [discountType, setDiscountType] = useState('percent');
  const [customPercent, setCustomPercent] = useState('');
  const [customAmount, setCustomAmount] = useState('');
  const [couponCodeInput, setCouponCodeInput] = useState('');
  const [couponValidating, setCouponValidating] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [foundCoupon, setFoundCoupon] = useState<{
    coupon: Coupon;
    discountAmount: number;
    linkedCustomer: Customer | null;
  } | null>(null);
  const smartpayProgress = getSmartpayCheckoutProgress(
    smartpayProgressStage ?? 'awaiting_terminal',
    null,
  );

  useEffect(() => {
    if (!discountDialogVisible) return;
    setCustomPercent('');
    setDiscountType('percent');
    setCustomAmount('');
    setCouponCodeInput('');
    setCouponError(null);
    setFoundCoupon(null);
  }, [discountDialogVisible]);

  const handleSearchCoupon = async () => {
    const code = couponCodeInput.trim().toUpperCase();
    if (!code) return;
    setCouponValidating(true);
    setCouponError(null);
    setFoundCoupon(null);
    try {
      const result = await validateCouponCode({
        code,
        cartSubtotal: cartSubtotal ?? total,
        userId: selectedCustomer?.id,
        customerEmail: selectedCustomer?.email,
      });
      if (result.isValid && result.coupon) {
        let linkedCustomer: Customer | null = null;
        if (result.coupon.user_id) {
          const { data: cData } = await findCustomerById(result.coupon.user_id);
          if (cData) linkedCustomer = cData;
        }
        if (!linkedCustomer && result.coupon.target_email) {
          const { data: cData } = await findCustomerByEmail(result.coupon.target_email);
          if (cData) linkedCustomer = cData;
        }

        if (!linkedCustomer && (result.coupon.target_email || result.coupon.user_id)) {
          linkedCustomer = {
            id: result.coupon.user_id || '',
            name: result.coupon.target_email || 'Targeted Customer',
            email: result.coupon.target_email || '',
            phone: '',
          };
        }

        setFoundCoupon({
          coupon: result.coupon,
          discountAmount: result.discountAmount,
          linkedCustomer,
        });
      } else {
        setCouponError(result.errorMessage || 'Coupon code not found or invalid.');
      }
    } catch (err: any) {
      setCouponError(err?.message || 'Failed to check coupon code.');
    } finally {
      setCouponValidating(false);
    }
  };

  const handleApplyFoundCoupon = () => {
    if (!foundCoupon) return;
    if (onApplyCouponDiscount) {
      onApplyCouponDiscount(foundCoupon.coupon, foundCoupon.discountAmount, foundCoupon.linkedCustomer);
    }
    setDiscountDialogVisible(false);
  };

  return (
    <>
      <CashTenderModal
        visible={cashTenderMode !== null}
        total={total}
        onCancel={onCancelCashTender}
        onConfirm={onConfirmCashTender}
      />

      <Portal>
        <FullScreenModal visible={smartpayProcessing && !smartpayDialogMinimized} title={smartpayProgress.title} subtitle={smartpayOrderNumber ? `Order #${smartpayOrderNumber}` : 'SmartPay payment'} onClose={confirmDismissSmartpayLock} closeLabel="Minimise SmartPay payment" closeIcon="window-minimize" footer={<Button icon="window-minimize" onPress={confirmDismissSmartpayLock} contentStyle={{ minHeight: 48 }}>Minimise & keep waiting</Button>}>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 }}>
            <Text style={styles.smartpayDialogText}>{smartpayProgress.message}</Text>
            <Text style={styles.smartpayAmount}>${total.toFixed(2)}</Text>
            <Text style={styles.smartpayDialogText}>Payment monitoring continues when minimised.</Text>
          </View>
        </FullScreenModal>

        <SelectionSheet
          selection={saltOptionDialogVisible ? { title: 'Salt preference', value: quickOrderNote || '', options: quickOrderNotes.map(note => ({ value: note, label: note })), onSelect: setQuickOrderNote } : null}
          onDismiss={() => setSaltOptionDialogVisible(false)}
        />

        <Dialog size="options" visible={Boolean(noteItemId)} onDismiss={closeNoteEditor} style={styles.noteDialog}>
          <Dialog.Title>Item note</Dialog.Title>
          <Dialog.Content>
            <Text style={{ color: t.color.text, fontSize: 13, fontWeight: '700', marginBottom: 10 }}>Quick notes</Text>
            {quickItemNotes.length > 0 && (
              <View style={[styles.itemNotePresetLinks, { flexWrap: 'wrap', gap: 8 }]}>
                {quickItemNotes.map((note) => {
                  const selected = hasNotePreset(noteDraft, note);
                  return (
                    <TouchableOpacity
                      key={note}
                      accessibilityRole="button"
                      accessibilityLabel={`${selected ? 'Remove' : 'Add'} note: ${note}`}
                      style={[styles.itemNotePresetLink, { borderWidth: 1, borderColor: selected ? t.color.primary : t.color.border, backgroundColor: selected ? t.color.primaryTint : t.color.surface, padding: 12, borderRadius: 8, minHeight: 44 }]}
                      onPress={() => setNoteDraft(toggleNotePreset(noteDraft, note))}
                    >
                      <Text style={[styles.itemNotePresetLinkText, selected && styles.itemNotePresetLinkTextSelected]} numberOfLines={1}>
                        {selected ? `✓ ${note}` : note}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
            <FormField
              label="Item note"
              mode="outlined"
              value={noteDraft}
              onChangeText={setNoteDraft}
              // Android predictive keyboards can recommit composing words in controlled inputs.
              autoCorrect={Platform.OS === 'android' ? false : undefined}
              multiline
              style={styles.noteInput}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button mode="outlined" onPress={closeNoteEditor}>Cancel</Button>
            <Button mode="contained" onPress={saveNote}>Save note</Button>
          </Dialog.Actions>
        </Dialog>

        <SelectionSheet
          deferSelectionUntilDismissed
          selection={instorePaymentDialogVisible ? {
            title: isEditingOrder ? 'Update order payment' : 'Complete in-store order',
            value: '',
            options: [
              { value: 'cash', label: 'Cash' },
              { value: 'card', label: 'Card' },
              { value: 'smartpay', label: 'SmartPay', disabled: !smartpayPaired || smartpayProcessing, description: !smartpayPaired ? 'Pair a SmartPay terminal in Settings to use this option.' : undefined },
              { value: 'unpaid', label: 'Unpaid' },
            ],
            onSelect: choice => onChooseInstorePayment(choice as EditedOrderPaymentChoice),
          } : null}
          onDismiss={() => setInstorePaymentDialogVisible(false)}
        />

        <Dialog
          visible={freeItemDialogVisible}
          onDismiss={() => setFreeItemDialogVisible(false)}
          style={styles.noteDialog}
        >
          <Dialog.Title>Select free item</Dialog.Title>
          <Dialog.Content>
            <ScrollView style={{ maxHeight: 360 }}>
              <View style={styles.quickOrderNoteGrid}>
                {eligibleFreeItemProducts.map((product) => (
                  <TouchableOpacity
                    key={product.id}
                    style={styles.quickOrderNoteChip}
                    onPress={() => onSelectFreeItem(product)}
                  >
                    <Text style={styles.quickOrderNoteChipText} numberOfLines={2}>
                      {product.name}
                    </Text>
                    <Text style={styles.cartItemMeta}>${product.sale_price.toFixed(2)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setFreeItemDialogVisible(false)}>Close</Button>
          </Dialog.Actions>
        </Dialog>

        <EditorSheet visible={discountDialogVisible} title="Apply a discount" onDismiss={() => setDiscountDialogVisible(false)} footer={<>
          {discountAmount > 0 && <Button onPress={() => { onClearDiscount(); setDiscountDialogVisible(false); }}>Remove</Button>}
          <Button mode="outlined" onPress={() => setDiscountDialogVisible(false)}>Cancel</Button>
          <Button mode="contained" disabled={couponValidating || (discountType === 'coupon' ? !foundCoupon : !Number.isFinite(Number(discountType === 'percent' ? customPercent : customAmount)) || Number(discountType === 'percent' ? customPercent : customAmount) <= 0 || (discountType === 'percent' && Number(customPercent) > 100))} onPress={() => { if (discountType === 'coupon') { handleApplyFoundCoupon(); return; } if (discountType === 'percent') onApplyCustomPercentDiscount(Number(customPercent)); else onApplyCustomFixedDiscount(Number(customAmount)); setDiscountDialogVisible(false); }}>Apply discount</Button>
        </>}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{[5,10,15,20,25].map(percent => <Button key={percent} mode="outlined" buttonColor={discountType === 'percent' && Number(customPercent) === percent ? t.color.primaryTint : t.color.surface} onPress={() => { setCustomPercent(String(percent)); setDiscountType('percent'); }}>{percent}%</Button>)}</View>
          <Text style={{ fontSize: 13, fontWeight: '700', color: t.color.text }}>Discount type</Text>
          <ChoiceTabs value={discountType} onValueChange={setDiscountType} buttons={[{ value: 'percent', label: 'Percent' }, { value: 'fixed', label: 'Fixed amount' }, { value: 'coupon', label: 'Coupon' }]} />
          <FormField label="Percentage" value={customPercent} onChangeText={value => { setCustomPercent(value); setDiscountType('percent'); }} keyboardType="decimal-pad" right={<TextInput.Affix text="%" />} />
          <FormField label="Fixed amount" value={customAmount} onChangeText={value => { setCustomAmount(value); setDiscountType('fixed'); }} keyboardType="decimal-pad" left={<TextInput.Affix text="$" />} />
          <FormField label="Coupon code" value={couponCodeInput} onChangeText={text => { setCouponCodeInput(text.toUpperCase()); setCouponError(null); setFoundCoupon(null); setDiscountType('coupon'); }} autoCapitalize="characters" />
          {discountType === 'coupon' && <Button mode="outlined" loading={couponValidating} disabled={couponValidating || !couponCodeInput.trim()} onPress={handleSearchCoupon}>Validate coupon</Button>}
          {!!couponError && <Text accessibilityRole="alert" style={{ color: t.color.danger }}>{couponError}</Text>}
          {foundCoupon && <View style={{ backgroundColor: t.color.successTint, padding: 14, borderRadius: 10, gap: 6 }}><Text style={{ fontWeight: '700', color: t.color.success }}>{foundCoupon.coupon.code} · {foundCoupon.coupon.title}</Text><Text style={{ color: t.color.text }}>Discount: ${foundCoupon.discountAmount.toFixed(2)}</Text>{foundCoupon.linkedCustomer && <Text style={{ color: t.color.muted }}>Customer: {foundCoupon.linkedCustomer.name}{foundCoupon.linkedCustomer.phone ? ` · ${foundCoupon.linkedCustomer.phone}` : ''}</Text>}</View>}
          <View style={{ padding: 16, backgroundColor: t.color.primaryTint, borderWidth: 1, borderColor: t.color.border, borderRadius: 10 }}><Text style={{ color: t.color.text }}>Subtotal ${(cartSubtotal ?? total).toFixed(2)} − {discountType === 'percent' ? `${Number(customPercent) || 0}%` : discountType === 'coupon' ? 'coupon' : 'fixed discount'} = <Text style={{ fontWeight: '700' }}>${Math.max(0, (cartSubtotal ?? total) - (discountType === 'percent' ? (cartSubtotal ?? total) * Math.min(100, Math.max(0, Number(customPercent) || 0)) / 100 : discountType === 'coupon' ? foundCoupon?.discountAmount || 0 : Number(customAmount) || 0)).toFixed(2)}</Text></Text></View>
        </EditorSheet>
      </Portal>
    </>
  );
}
