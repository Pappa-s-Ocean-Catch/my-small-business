import { ActionButton as Button } from '@/components/ui/ActionButton';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Icon, TextInput } from 'react-native-paper';
import { EditorSheet, designTokens as tokens } from '@/components/ui';

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
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  const short = height < 500;
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

  const quickNotes = (
    <View style={[styles.quickRow, landscape && styles.quickColumn]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Tender exact amount" style={({ pressed }) => [styles.quickNote, landscape && styles.quickNoteLandscape, pressed && styles.pressed]} onPress={() => selectAmount((totalCents / 100).toFixed(2))}>
        <Text style={styles.quickNoteText}>Exact</Text>
      </Pressable>
      {QUICK_NOTES.map((note) => (
        <Pressable key={note} accessibilityRole="button" accessibilityLabel={`Tender ${note} dollars`} accessibilityState={{ selected: tenderedCents === note * 100 }} style={({ pressed }) => [styles.quickNote, landscape && styles.quickNoteLandscape, tenderedCents === note * 100 && styles.quickNoteSelected, pressed && styles.pressed]} onPress={() => selectAmount(note.toFixed(2))}>
          <Text style={[styles.quickNoteText, tenderedCents === note * 100 && styles.quickNoteTextSelected]}>${note}</Text>
        </Pressable>
      ))}
    </View>
  );

  return (
    <EditorSheet
      visible={visible}
      title="Cash tender"
      onDismiss={onCancel}
      pending={confirming}
      scrollable={false}
      headerStyle={[styles.header, short && styles.headerShort]}
      bodyStyle={[styles.body, short && styles.bodyShort]}
    >
      <View style={[styles.layout, landscape && styles.landscape]}>
        <View style={[styles.summary, landscape && styles.summaryLandscape]}>
          <View style={styles.due}>
            <Text style={styles.summaryLabel}>Amount due</Text>
            <Text adjustsFontSizeToFit numberOfLines={1} style={[styles.totalValue, landscape && styles.totalValueLandscape]}>{money(totalCents)}</Text>
          </View>
          <View style={styles.balances}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Tendered</Text>
              <Text adjustsFontSizeToFit numberOfLines={1} style={styles.tenderValue}>{money(tenderedCents)}</Text>
            </View>
            <View style={styles.summaryRow} accessibilityLiveRegion="polite">
              <Text style={styles.summaryLabel}>{changeCents < 0 ? 'Amount short' : 'Change'}</Text>
              <Text adjustsFontSizeToFit numberOfLines={1} style={[styles.changeValue, changeCents < 0 && styles.shortValue]}>{money(Math.abs(changeCents))}</Text>
            </View>
          </View>
          {landscape && quickNotes}
        </View>
        <View style={[styles.controls, short && styles.controlsShort]}>
          <View style={styles.inputRow}>
            <TextInput mode="outlined" dense label="Amount tendered" accessibilityLabel="Amount tendered" value={amountText} onChangeText={updateAmount} keyboardType="decimal-pad" showSoftInputOnFocus={false} selectTextOnFocus disabled={confirming} style={styles.input} />
            <Button mode="outlined" accessibilityLabel="Clear tender" onPress={() => { replaceOnKey.current = false; setAmountText(''); }} style={styles.clear} contentStyle={styles.actionContent}>Clear</Button>
          </View>
          {!landscape && quickNotes}
          <View style={[styles.keypad, short && styles.keypadShort]}>
            {Array.from({ length: 4 }, (_, row) => <View style={[styles.keyRow, short && styles.keyRowShort]} key={row}>
              {KEYS.slice(row * 3, row * 3 + 3).map((key) => (
                <Pressable accessibilityRole="button" accessibilityLabel={key === 'back' ? 'Backspace' : key === '.' ? 'Decimal point' : key} key={key} style={({ pressed }) => [styles.key, short && styles.keyShort, pressed && styles.pressed]} onPress={() => pressKey(key)}>
                  {key === 'back' ? <Icon source="backspace-outline" size={27} color={tokens.color.text} /> : <Text style={styles.keyText}>{key}</Text>}
                </Pressable>
              ))}
            </View>)}
          </View>
          <View style={styles.actions}>
            <Button mode="outlined" onPress={onCancel} disabled={confirming} style={styles.action} contentStyle={styles.actionContent} labelStyle={styles.actionLabel}>Cancel</Button>
            <Button mode="contained" onPress={confirm} disabled={!canConfirm} loading={confirming} buttonColor={tokens.color.primary} style={[styles.action, styles.confirmAction]} contentStyle={styles.actionContent} labelStyle={styles.actionLabel}>Confirm cash payment</Button>
          </View>
        </View>
      </View>
    </EditorSheet>
  );
}

const styles = StyleSheet.create({
  header: { paddingVertical: 8, minHeight: 56 },
  headerShort: { paddingVertical: 4, minHeight: 48 },
  body: { padding: 12, gap: 0 },
  bodyShort: { padding: 8 },
  layout: { flex: 1, minHeight: 0, gap: 8 },
  landscape: { flexDirection: 'row', gap: 12 },
  summary: { backgroundColor: tokens.color.navy, borderRadius: tokens.radius.card, padding: 8, gap: 12, flexDirection: 'row', alignItems: 'center' },
  summaryLandscape: { flex: 1, padding: 12, flexDirection: 'column', alignItems: 'stretch', justifyContent: 'center' },
  due: { flexShrink: 1, minWidth: 0 },
  balances: { flexGrow: 1, minWidth: 0, gap: 4 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4 },
  summaryLabel: { color: tokens.color.surface, fontSize: 12 },
  totalValue: { color: tokens.color.surface, fontSize: 28, fontWeight: '700', fontVariant: ['tabular-nums'] },
  totalValueLandscape: { fontSize: 36 },
  tenderValue: { flexShrink: 1, color: tokens.color.surface, fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  changeValue: { flexShrink: 1, color: '#A0DFC3', fontSize: 18, fontWeight: '700', fontVariant: ['tabular-nums'] },
  shortValue: { color: '#FFCECB' },
  controls: { flex: 2, minWidth: 0, minHeight: 0, gap: 8 },
  controlsShort: { gap: 4 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { flex: 1, minWidth: 0, height: 48, backgroundColor: tokens.color.surface },
  quickRow: { flexDirection: 'row', gap: 4 },
  quickColumn: { flexWrap: 'wrap', gap: 6 },
  quickNote: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: tokens.radius.control, borderWidth: 1, borderColor: tokens.color.border, backgroundColor: tokens.color.surface },
  quickNoteLandscape: { flexBasis: '30%', minHeight: 44 },
  quickNoteSelected: { borderColor: tokens.color.primary, backgroundColor: tokens.color.primaryTint },
  quickNoteText: { color: tokens.color.text, fontSize: 14, fontWeight: '700' },
  quickNoteTextSelected: { color: tokens.color.primaryPressed },
  keypad: { flex: 1, minHeight: 216, gap: 8 },
  keypadShort: { minHeight: 188, gap: 4 },
  keyRow: { flex: 1, flexDirection: 'row', gap: 8 },
  keyRowShort: { gap: 4 },
  key: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: tokens.radius.control, backgroundColor: tokens.color.surface, borderWidth: 1, borderColor: tokens.color.border },
  keyShort: { minHeight: 44 },
  pressed: { opacity: 0.65 },
  keyText: { color: tokens.color.text, fontSize: 24, fontWeight: '700' },
  clear: { borderRadius: tokens.radius.control, borderColor: tokens.color.border },
  actions: { flexDirection: 'row', gap: 8 },
  action: { borderRadius: tokens.radius.control },
  confirmAction: { flex: 1 },
  actionContent: { minHeight: 48 },
  actionLabel: { fontSize: 14, marginHorizontal: 10 },
});
