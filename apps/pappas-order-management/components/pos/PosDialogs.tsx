import React, { useEffect, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Button, Dialog, Portal, TextInput } from 'react-native-paper';

import { CashTenderModal } from '../CashTenderModal';
import { styles } from './pos.styles';
import type { CashTenderMode, PosInstorePaymentChoice } from '../../app/pos.types';

type Props = {
  cashTenderMode: CashTenderMode | null;
  total: number;
  onCancelCashTender: () => void;
  onConfirmCashTender: () => void;
  smartpayProcessing: boolean;
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
  discountDialogVisible: boolean;
  setDiscountDialogVisible: (visible: boolean) => void;
  discountLabel: string;
  discountAmount: number;
  onApplyPresetDiscount: (percent: number) => void;
  onApplyCustomPercentDiscount: (percent: number) => void;
  onApplyCustomFixedDiscount: (amount: number) => void;
  onClearDiscount: () => void;
};

export function PosDialogs({
  cashTenderMode,
  total,
  onCancelCashTender,
  onConfirmCashTender,
  smartpayProcessing,
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
  discountDialogVisible,
  setDiscountDialogVisible,
  discountLabel,
  discountAmount,
  onApplyPresetDiscount,
  onApplyCustomPercentDiscount,
  onApplyCustomFixedDiscount,
  onClearDiscount,
}: Props) {
  const [customPercent, setCustomPercent] = useState('');
  const [customAmount, setCustomAmount] = useState('');

  useEffect(() => {
    if (!discountDialogVisible) return;
    setCustomPercent('');
    setCustomAmount('');
  }, [discountDialogVisible]);

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
          visible={smartpayProcessing}
          dismissable
          onDismiss={confirmDismissSmartpayLock}
          style={styles.smartpayDialog}
        >
          <Dialog.Title>SmartPay payment</Dialog.Title>
          <Dialog.Content>
            <Text style={styles.smartpayDialogText}>
              Follow the prompts on the terminal. This screen will unlock when Smartpay returns the result.
            </Text>
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
