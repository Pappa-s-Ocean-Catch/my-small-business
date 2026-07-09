import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Button, Dialog, Portal, TextInput } from 'react-native-paper';

import { CashTenderModal } from '../CashTenderModal';
import { styles } from '../../app/pos.styles';
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
}: Props) {
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
      </Portal>
    </>
  );
}
