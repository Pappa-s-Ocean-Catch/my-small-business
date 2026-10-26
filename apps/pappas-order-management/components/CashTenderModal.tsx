import { ActionButton as Button } from '@/components/ui/ActionButton';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from 'react-native-paper';
import { EditorSheet, FormField, designTokens as tokens } from '@/components/ui';

type CashTenderModalProps = {
  visible: boolean;
  total: number;
  onCancel: () => void;
  onConfirm: (tendered: number) => void;
};

const QUICK_NOTES = [5, 10, 20, 50, 100];
const KEYS = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '.', '0', 'back'];
const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

// Parse decimal digits directly so change and coverage are compared in whole cents.
const centsFromText = (text: string) => {
  const [dollars = '', fraction = ''] = text.split('.');
  return Number(dollars || '0') * 100 + Number(fraction.padEnd(2, '0'));
};

export function CashTenderModal({ visible, total, onCancel, onConfirm }: CashTenderModalProps) {
  const [amountText, setAmountText] = useState('50.00');
  const [confirming, setConfirming] = useState(false);
  const confirmed = useRef(false);
  const replaceOnKey = useRef(true);

  useEffect(() => {
    if (visible) {
      setAmountText('50.00');
      setConfirming(false);
      confirmed.current = false;
      replaceOnKey.current = true;
    }
  }, [visible]);

  const totalCents = Math.round(total * 100);
  const tenderedCents = centsFromText(amountText);
  const changeCents = tenderedCents - totalCents;
  const canConfirm = Number.isSafeInteger(tenderedCents) && Number.isSafeInteger(totalCents)
    && totalCents >= 0 && tenderedCents >= totalCents && !confirming;

  const updateAmount = (text: string) => {
    if (!/^\d{0,7}(\.\d{0,2})?$/.test(text)) return;
    replaceOnKey.current = false;
    setAmountText(text);
  };
  const selectAmount = (text: string) => {
    setAmountText(text);
    replaceOnKey.current = true;
  };
  const pressKey = (key: string) => {
    if (key === 'back') {
      replaceOnKey.current = false;
      setAmountText((previous) => previous.slice(0, -1));
      return;
    }
    const previous = replaceOnKey.current ? '' : amountText;
    updateAmount(key === '.' && !previous ? '0.' : previous === '0' && key !== '.' ? key : `${previous}${key}`);
  };
  const confirm = () => {
    if (!canConfirm || confirmed.current) return;
    confirmed.current = true;
    setConfirming(true);
    onConfirm(tenderedCents / 100);
  };

  return (
    <EditorSheet
      visible={visible}
      title="Cash tender"

      onDismiss={onCancel}
      pending={confirming}
      footer={<>
        <Button mode="outlined" onPress={onCancel} disabled={confirming} style={styles.action} contentStyle={styles.actionContent}>Cancel</Button>
        <Button mode="contained" onPress={confirm} disabled={!canConfirm} loading={confirming} buttonColor={tokens.color.primary} style={styles.action} contentStyle={styles.actionContent}>Confirm cash payment</Button>
      </>}
    >
      <View style={styles.summary}>
        <Text style={styles.summaryLabel}>Amount due</Text>
        <Text style={styles.totalValue}>{money(totalCents)}</Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Tendered</Text>
          <Text style={styles.tenderValue}>{money(tenderedCents)}</Text>
        </View>
        <View style={styles.summaryRow} accessibilityLiveRegion="polite">
          <Text style={styles.summaryLabel}>{changeCents < 0 ? 'Amount short' : 'Change'}</Text>
          <Text style={[styles.changeValue, changeCents < 0 && styles.shortValue]}>{money(Math.abs(changeCents))}</Text>
        </View>
      </View>
      <FormField label="Amount tendered" value={amountText} onChangeText={updateAmount} keyboardType="decimal-pad" selectTextOnFocus disabled={confirming} />
      <View style={styles.quickRow}>
        <Pressable accessibilityRole="button" accessibilityLabel="Tender exact amount" style={({ pressed }) => [styles.quickNote, pressed && styles.pressed]} onPress={() => selectAmount((totalCents / 100).toFixed(2))}>
          <Text style={styles.quickNoteText}>Exact</Text>
        </Pressable>
        {QUICK_NOTES.map((note) => (
          <Pressable key={note} accessibilityRole="button" accessibilityLabel={`Tender ${note} dollars`} accessibilityState={{ selected: tenderedCents === note * 100 }} style={({ pressed }) => [styles.quickNote, tenderedCents === note * 100 && styles.quickNoteSelected, pressed && styles.pressed]} onPress={() => selectAmount(note.toFixed(2))}>
            <Text style={[styles.quickNoteText, tenderedCents === note * 100 && styles.quickNoteTextSelected]}>${note}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.keypad}>
        {Array.from({ length: 4 }, (_, row) => <View style={styles.keyRow} key={row}>
          {KEYS.slice(row * 3, row * 3 + 3).map((key) => (
            <Pressable accessibilityRole="button" accessibilityLabel={key === 'back' ? 'Backspace' : key === '.' ? 'Decimal point' : key} key={key} style={({ pressed }) => [styles.key, pressed && styles.pressed]} onPress={() => pressKey(key)}>
              {key === 'back' ? <Icon source="backspace-outline" size={27} color={tokens.color.text} /> : <Text style={styles.keyText}>{key}</Text>}
            </Pressable>
          ))}
        </View>)}
      </View>
      <Button mode="outlined" onPress={() => { replaceOnKey.current = false; setAmountText(''); }} style={styles.clear} contentStyle={styles.actionContent}>Clear tender</Button>
    </EditorSheet>
  );
}

const styles = StyleSheet.create({
  summary: { backgroundColor: tokens.color.navy, borderRadius: tokens.radius.card, padding: 20, gap: 10 },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  summaryLabel: { color: tokens.color.surface, fontSize: 16 },
  totalValue: { color: tokens.color.surface, fontSize: 39, fontWeight: '700', marginBottom: 8, fontVariant: ['tabular-nums'] },
  tenderValue: { color: tokens.color.surface, fontSize: 17, fontWeight: '700', fontVariant: ['tabular-nums'] },
  changeValue: { color: '#A0DFC3', fontSize: 24, fontWeight: '700', fontVariant: ['tabular-nums'] },
  shortValue: { color: '#FFCECB' },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickNote: { minWidth: 48, minHeight: 48, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', borderRadius: tokens.radius.control, borderWidth: 1, borderColor: tokens.color.border, backgroundColor: tokens.color.surface },
  quickNoteSelected: { borderColor: tokens.color.primary, backgroundColor: tokens.color.primaryTint },
  quickNoteText: { color: tokens.color.text, fontSize: 15, fontWeight: '700' },
  quickNoteTextSelected: { color: tokens.color.primaryPressed },
  keypad: { gap: 10 },
  keyRow: { flexDirection: 'row', gap: 10 },
  key: { flex: 1, minHeight: 62, alignItems: 'center', justifyContent: 'center', borderRadius: tokens.radius.control, backgroundColor: tokens.color.surface, borderWidth: 1, borderColor: tokens.color.border },
  pressed: { opacity: 0.65 },
  keyText: { color: tokens.color.text, fontSize: 24, fontWeight: '700' },
  clear: { alignSelf: 'flex-start', borderRadius: tokens.radius.control, borderColor: tokens.color.border },
  action: { borderRadius: tokens.radius.control },
  actionContent: { minHeight: tokens.touch.primaryHeight },
});
