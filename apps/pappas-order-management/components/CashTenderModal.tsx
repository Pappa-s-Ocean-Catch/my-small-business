import React, { useEffect, useMemo, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Button, Surface } from 'react-native-paper';

type CashTenderModalProps = {
  visible: boolean;
  total: number;
  onCancel: () => void;
  onConfirm: (tendered: number) => void;
};

const QUICK_NOTES = [5, 10, 20, 50, 100];
const KEYS = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '.', '0', 'back'];

const money = (value: number) => `$${value.toFixed(2)}`;

export function CashTenderModal({ visible, total, onCancel, onConfirm }: CashTenderModalProps) {
  const defaultTender = 50;
  const [amountText, setAmountText] = useState(String(defaultTender));

  useEffect(() => {
    if (visible) {
      setAmountText(String(defaultTender));
    }
  }, [defaultTender, visible]);

  const tendered = Number(amountText) || 0;
  const change = tendered - total;
  const canConfirm = tendered >= total;

  const displayTender = useMemo(() => {
    if (!amountText) return '$0.00';
    return money(tendered);
  }, [amountText, tendered]);

  const pressKey = (key: string) => {
    if (key === 'back') {
      setAmountText((prev) => prev.slice(0, -1));
      return;
    }

    if (key === '.' && amountText.includes('.')) return;

    setAmountText((prev) => {
      const next = prev === '0' && key !== '.' ? key : `${prev}${key}`;
      const [, decimals = ''] = next.split('.');
      if (decimals.length > 2) return prev;
      return next;
    });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <Surface style={styles.panel} elevation={4}>
          <Text style={styles.title}>Cash tender</Text>

          <View style={styles.summary}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total</Text>
              <Text style={styles.totalValue}>{money(total)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Tendered</Text>
              <Text style={styles.tenderValue}>{displayTender}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Change</Text>
              <Text style={[styles.changeValue, change < 0 && styles.shortValue]}>
                {change >= 0 ? money(change) : `${money(Math.abs(change))} short`}
              </Text>
            </View>
          </View>

          <View style={styles.quickRow}>
            {QUICK_NOTES.map((note) => (
              <TouchableOpacity
                key={note}
                style={[styles.quickNote, tendered === note && styles.quickNoteSelected]}
                onPress={() => setAmountText(String(note))}
              >
                <Text style={[styles.quickNoteText, tendered === note && styles.quickNoteTextSelected]}>
                  ${note}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.keypad}>
            {KEYS.map((key) => (
              <TouchableOpacity key={key} style={styles.key} onPress={() => pressKey(key)}>
                <Text style={styles.keyText}>{key === 'back' ? 'DEL' : key}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.actions}>
            <Button mode="outlined" onPress={onCancel} style={styles.actionButton}>
              Cancel
            </Button>
            <Button
              mode="contained"
              disabled={!canConfirm}
              onPress={() => onConfirm(tendered)}
              style={styles.actionButton}
              buttonColor="#16a34a"
            >
              Confirm cash
            </Button>
          </View>
        </Surface>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.62)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  },
  panel: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 8,
    backgroundColor: '#fff',
    padding: 18,
  },
  title: { color: '#111827', fontSize: 22, fontWeight: '900', marginBottom: 14 },
  summary: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, overflow: 'hidden' },
  summaryRow: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  summaryLabel: { color: '#6b7280', fontSize: 15, fontWeight: '700' },
  totalValue: { color: '#111827', fontSize: 18, fontWeight: '900' },
  tenderValue: { color: '#2563eb', fontSize: 22, fontWeight: '900' },
  changeValue: { color: '#16a34a', fontSize: 22, fontWeight: '900' },
  shortValue: { color: '#dc2626', fontSize: 18 },
  quickRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  quickNote: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#f9fafb',
  },
  quickNoteSelected: { borderColor: '#2563eb', backgroundColor: '#dbeafe' },
  quickNoteText: { color: '#111827', fontSize: 15, fontWeight: '900' },
  quickNoteTextSelected: { color: '#1d4ed8' },
  keypad: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  key: {
    width: '31.8%',
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  keyText: { color: '#111827', fontSize: 24, fontWeight: '900' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  actionButton: { flex: 1, borderRadius: 8 },
});
