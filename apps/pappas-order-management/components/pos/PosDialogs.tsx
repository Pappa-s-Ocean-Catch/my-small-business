import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Button, Dialog, Portal, TextInput } from 'react-native-paper';

import { getCouponsList, validateCouponCode, type Coupon } from '../../lib/coupons';
import { findCustomerById, findCustomerByEmail, type Customer } from '../../lib/customers';
import { CashTenderModal } from '../CashTenderModal';
import { styles } from './pos.styles';
import type { CashTenderMode, PosInstorePaymentChoice, SaleProduct } from '../../app/pos.types';
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
  smartpayOrderNumber: string | null;
  smartpayProgressStage: SmartpayCheckoutProgressStage | null;
  smartpayDialogMinimized: boolean;
  confirmDismissSmartpayLock: () => void;
  saltOptionDialogVisible: boolean;
  setSaltOptionDialogVisible: (visible: boolean) => void;
  quickOrderNotes: string[];
  quickOrderNote: string | null;
  setQuickOrderNote: (value: string | null) => void;
  noteItemId: string | null;
  closeNoteEditor: () => void;
  noteDraft: string;
  setNoteDraft: (value: string) => void;
  saveNote: () => void;
  instorePaymentDialogVisible: boolean;
  setInstorePaymentDialogVisible: (visible: boolean) => void;
  onChooseInstorePayment: (choice: PosInstorePaymentChoice) => void;
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
  smartpayOrderNumber,
  smartpayProgressStage,
  smartpayDialogMinimized,
  confirmDismissSmartpayLock,
  saltOptionDialogVisible,
  setSaltOptionDialogVisible,
  quickOrderNotes,
  quickOrderNote,
  setQuickOrderNote,
  noteItemId,
  closeNoteEditor,
  noteDraft,
  setNoteDraft,
  saveNote,
  instorePaymentDialogVisible,
  setInstorePaymentDialogVisible,
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
        <Dialog
          visible={smartpayProcessing && !smartpayDialogMinimized}
          dismissable
          onDismiss={confirmDismissSmartpayLock}
          style={styles.smartpayDialog}
        >
          <Dialog.Title>{smartpayProgress.title}</Dialog.Title>
          <Dialog.Content>
            <Text style={styles.smartpayDialogText}>
              {smartpayProgress.message}
            </Text>
            {smartpayOrderNumber && (
              <Text style={styles.smartpayDialogText}>Order #{smartpayOrderNumber}</Text>
            )}
            <Text style={styles.smartpayAmount}>${total.toFixed(2)}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={confirmDismissSmartpayLock}>Hide</Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog
          visible={saltOptionDialogVisible}
          onDismiss={() => setSaltOptionDialogVisible(false)}
          style={styles.noteDialog}
        >
          <Dialog.Title>Salt option</Dialog.Title>
          <Dialog.Content>
            <View style={styles.quickOrderNoteGrid}>
              {quickOrderNotes.map((note) => {
                const selected = quickOrderNote === note;
                return (
                  <TouchableOpacity
                    key={note}
                    style={[styles.quickOrderNoteChip, selected && styles.quickOrderNoteChipSelected]}
                    onPress={() => {
                      setQuickOrderNote(selected ? null : note);
                      setSaltOptionDialogVisible(false);
                    }}
                  >
                    <Text style={[styles.quickOrderNoteChipText, selected && styles.quickOrderNoteChipTextSelected]} numberOfLines={2}>
                      {note}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            {quickOrderNote && (
              <Button onPress={() => {
                setQuickOrderNote(null);
                setSaltOptionDialogVisible(false);
              }}>
                Clear
              </Button>
            )}
            <Button onPress={() => setSaltOptionDialogVisible(false)}>Close</Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={Boolean(noteItemId)} onDismiss={closeNoteEditor} style={styles.noteDialog}>
          <Dialog.Title>Item note</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Note"
              mode="outlined"
              value={noteDraft}
              onChangeText={setNoteDraft}
              multiline
              style={styles.noteInput}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={closeNoteEditor}>Cancel</Button>
            <Button onPress={saveNote}>Save</Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog
          visible={instorePaymentDialogVisible}
          onDismiss={() => setInstorePaymentDialogVisible(false)}
          style={styles.noteDialog}
        >
          <Dialog.Title>Complete In-store Order</Dialog.Title>
          <Dialog.Content>
            <Text style={styles.smartpayDialogText}>
              Choose how this order should be recorded before it is created.
            </Text>
            <View style={styles.dialogActionStack}>
              <Button mode="contained" icon="cash" onPress={() => onChooseInstorePayment('cash')}>
                Cash
              </Button>
              <Button mode="contained-tonal" icon="credit-card-outline" onPress={() => onChooseInstorePayment('card')}>
                Card
              </Button>
              <Button mode="outlined" icon="clock-outline" onPress={() => onChooseInstorePayment('unpaid')}>
                Unpaid
              </Button>
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setInstorePaymentDialogVisible(false)}>Cancel</Button>
          </Dialog.Actions>
        </Dialog>

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

        <Dialog
          visible={discountDialogVisible}
          onDismiss={() => setDiscountDialogVisible(false)}
          style={styles.noteDialog}
        >
          <Dialog.Title>Apply discount</Dialog.Title>
          <Dialog.Content>
            <Text style={styles.smartpayDialogText}>
              Current: {discountAmount > 0 ? `${discountLabel} (-$${discountAmount.toFixed(2)})` : 'No discount'}
            </Text>
            <View style={styles.discountPresetGrid}>
              {[5, 10, 15, 20, 25].map((percent) => (
                <TouchableOpacity
                  key={percent}
                  style={styles.discountPresetButton}
                  onPress={() => {
                    onApplyPresetDiscount(percent);
                    setDiscountDialogVisible(false);
                  }}
                >
                  <Text style={styles.discountPresetButtonText}>{percent}%</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.discountInputGroup}>
              <TextInput
                label="Custom percent"
                mode="outlined"
                value={customPercent}
                onChangeText={setCustomPercent}
                keyboardType="decimal-pad"
                style={styles.checkoutInput}
                right={<TextInput.Affix text="%" />}
              />
              <Button
                mode="contained-tonal"
                disabled={!Number.isFinite(Number(customPercent)) || Number(customPercent) <= 0}
                onPress={() => {
                  onApplyCustomPercentDiscount(Number(customPercent));
                  setDiscountDialogVisible(false);
                }}
              >
                Apply %
              </Button>
            </View>

            <View style={styles.discountInputGroup}>
              <TextInput
                label="Fixed amount"
                mode="outlined"
                value={customAmount}
                onChangeText={setCustomAmount}
                keyboardType="decimal-pad"
                style={styles.checkoutInput}
                left={<TextInput.Affix text="$" />}
              />
              <Button
                mode="contained-tonal"
                disabled={!Number.isFinite(Number(customAmount)) || Number(customAmount) <= 0}
                onPress={() => {
                  onApplyCustomFixedDiscount(Number(customAmount));
                  setDiscountDialogVisible(false);
                }}
              >
                Apply $
              </Button>
            </View>

            <View style={{ marginTop: 14, borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 12 }}>
              <Text style={{ fontWeight: 'bold', fontSize: 14, color: '#1e293b', marginBottom: 6 }}>
                Find & Apply Coupon Code
              </Text>
              <View style={styles.discountInputGroup}>
                <TextInput
                  label="Enter Coupon Code"
                  mode="outlined"
                  value={couponCodeInput}
                  onChangeText={(text) => {
                    setCouponCodeInput(text.toUpperCase());
                    if (couponError) setCouponError(null);
                    if (foundCoupon) setFoundCoupon(null);
                  }}
                  autoCapitalize="characters"
                  placeholder="e.g. SUMMER20"
                  style={styles.checkoutInput}
                />
                <Button
                  mode="contained-tonal"
                  loading={couponValidating}
                  disabled={couponValidating || !couponCodeInput.trim()}
                  onPress={handleSearchCoupon}
                >
                  Search
                </Button>
              </View>
              {couponError ? (
                <Text style={{ color: '#d32f2f', marginTop: 6, fontSize: 13, fontWeight: '500' }}>
                  {couponError}
                </Text>
              ) : null}

              {/* Found Coupon Card Preview */}
              {foundCoupon ? (
                <View style={{ marginTop: 12, padding: 12, backgroundColor: '#f0fdf4', borderRadius: 8, borderWidth: 1, borderColor: '#bbf7d0' }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={{ fontWeight: 'bold', fontSize: 16, color: '#166534' }}>
                          {foundCoupon.coupon.code}
                        </Text>
                        <Text style={{ fontWeight: '700', fontSize: 12, color: '#15803d', backgroundColor: '#dcfce7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                          {foundCoupon.coupon.discount_type === 'percent'
                            ? `${foundCoupon.coupon.discount_value}% OFF (-$${foundCoupon.discountAmount.toFixed(2)})`
                            : `$${foundCoupon.coupon.discount_value.toFixed(2)} OFF`}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 13, color: '#334155', marginTop: 4, fontWeight: '500' }}>
                        {foundCoupon.coupon.title}
                      </Text>
                    </View>
                    <Button
                      mode="contained"
                      style={{ backgroundColor: '#15803d' }}
                      onPress={handleApplyFoundCoupon}
                    >
                      Apply Coupon
                    </Button>
                  </View>

                  {foundCoupon.coupon.target_email || foundCoupon.coupon.user_id ? (
                    <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#dcfce7' }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: '#166534' }}>
                        Targeted Customer Record:
                      </Text>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: '#1e293b', marginTop: 2 }}>
                        {foundCoupon.linkedCustomer?.name || foundCoupon.coupon.target_email || 'Targeted Customer'} {foundCoupon.linkedCustomer?.phone ? `(${foundCoupon.linkedCustomer.phone})` : ''}
                      </Text>
                      {foundCoupon.coupon.target_email || foundCoupon.linkedCustomer?.email ? (
                        <Text style={{ fontSize: 12, color: '#64748b' }}>
                          Email: {foundCoupon.linkedCustomer?.email || foundCoupon.coupon.target_email}
                        </Text>
                      ) : null}
                    </View>
                  ) : (
                    <Text style={{ fontSize: 11, color: '#64748b', marginTop: 6, fontStyle: 'italic' }}>
                      Public coupon (Applies discount to current order)
                    </Text>
                  )}
                </View>
              ) : null}
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            {discountAmount > 0 && (
              <Button onPress={() => {
                onClearDiscount();
                setDiscountDialogVisible(false);
              }}>
                Remove
              </Button>
            )}
            <Button onPress={() => setDiscountDialogVisible(false)}>Close</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </>
  );
}
